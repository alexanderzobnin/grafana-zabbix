import _ from 'lodash';
import moment from 'moment';
import * as c from './constants';
import { VariableQuery, VariableQueryTypes } from './types';
import { MappingType, ValueMapping, getValueFormats, DataFrame, FieldType, rangeUtil } from '@grafana/data';

/*
 * This regex matches 3 types of variable reference with an optional format specifier
 * \$(\w+)                          $var1
 * \[\[([\s\S]+?)(?::(\w+))?\]\]    [[var2]] or [[var2:fmt2]]
 * \${(\w+)(?::(\w+))?}             ${var3} or ${var3:fmt3}
 */
export const variableRegex = /\$(\w+)|\[\[([\s\S]+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::(\w+))?}/g;

/**
 * Expand Zabbix item name
 *
 * @param  {string} name item name, ie "CPU $2 time"
 * @param  {string} key  item key, ie system.cpu.util[,system,avg1]
 * @return {string}      expanded name, ie "CPU system time"
 */
export function expandItemName(name: string, key: string): string {

  // extract params from key:
  // "system.cpu.util[,system,avg1]" --> ["", "system", "avg1"]
  const key_params_str = key.substring(key.indexOf('[') + 1, key.lastIndexOf(']'));
  const key_params = splitKeyParams(key_params_str);

  // replace item parameters
  for (let i = key_params.length; i >= 1; i--) {
    name = name.replace('$' + i, key_params[i - 1]);
  }
  return name;
}

export function expandItems(items) {
  _.forEach(items, item => {
    item.item = item.name;
    item.name = expandItemName(item.item, item.key_);
    return item;
  });
  return items;
}

function splitKeyParams(paramStr) {
  const params = [];
  let quoted = false;
  let in_array = false;
  const split_symbol = ',';
  let param = '';

  _.forEach(paramStr, symbol => {
    if (symbol === '"' && in_array) {
      param += symbol;
    } else if (symbol === '"' && quoted) {
      quoted = false;
    } else if (symbol === '"' && !quoted) {
      quoted = true;
    } else if (symbol === '[' && !quoted) {
      in_array  = true;
    } else if (symbol === ']' && !quoted) {
      in_array = false;
    } else if (symbol === split_symbol && !quoted && !in_array) {
      params.push(param);
      param = '';
    } else {
      param += symbol;
    }
  });

  params.push(param);
  return params;
}

const MACRO_PATTERN = /{\$[A-Z0-9_\.]+}/g;

export function containsMacro(itemName) {
  return MACRO_PATTERN.test(itemName);
}

export function replaceMacro(item, macros, isTriggerItem?) {
  let itemName = isTriggerItem ? item.url : item.name;
  const item_macros = itemName.match(MACRO_PATTERN);
  _.forEach(item_macros, macro => {
    const host_macros = _.filter(macros, m => {
      if (m.hostid) {
        if (isTriggerItem) {
          // Trigger item can have multiple hosts
          // Check all trigger host ids against macro host id
          let hostIdFound = false;
          _.forEach(item.hosts, h => {
            if (h.hostid === m.hostid) {
              hostIdFound = true;
            }
          });
          return hostIdFound;
        } else {
          // Check app host id against macro host id
          return m.hostid === item.hostid;
        }
      } else {
        // Add global macros
        return true;
      }
    });

    const macro_def = _.find(host_macros, { macro: macro });
    if (macro_def && macro_def.value) {
      const macro_value = macro_def.value;
      const macro_regex = new RegExp(escapeMacro(macro));
      itemName = itemName.replace(macro_regex, macro_value);
    }
  });

  return itemName;
}

function escapeMacro(macro) {
  macro = macro.replace(/\$/, '\\\$');
  return macro;
}

export function parseLegacyVariableQuery(query: string): VariableQuery {
  let queryType: VariableQueryTypes;
  const parts = [];

  // Split query. Query structure: group.host.app.item
  _.each(splitTemplateQuery(query), part => {
    // Replace wildcard to regex
    if (part === '*') {
      part = '/.*/';
    }
    parts.push(part);
  });
  const template = _.zipObject(['group', 'host', 'app', 'item'], parts);

  if (parts.length === 4 && template.app === '/.*/') {
    // Search for all items, even it's not belong to any application
    template.app = '';
  }

  switch (parts.length) {
    case 1:
      queryType = VariableQueryTypes.Group;
      break;
    case 2:
      queryType = VariableQueryTypes.Host;
      break;
    case 3:
      queryType = VariableQueryTypes.Application;
      break;
    case 4:
      queryType = VariableQueryTypes.Item;
      break;
  }

  const variableQuery: VariableQuery = {
    queryType,
    group: template.group || '',
    host: template.host || '',
    application: template.app || '',
    item: template.item || '',
  };

  return variableQuery;
}

/**
 * Split template query to parts of zabbix entities
 * group.host.app.item -> [group, host, app, item]
 * {group}{host.com} -> [group, host.com]
 */
export function splitTemplateQuery(query) {
  const splitPattern = /\{[^\{\}]*\}|\{\/.*\/\}/g;
  let split;

  if (isContainsBraces(query)) {
    const result = query.match(splitPattern);
    split = _.map(result, part => {
      return _.trim(part, '{}');
    });
  } else {
    split = query.split('.');
  }

  return split;
}

function isContainsBraces(query) {
  const bracesPattern = /^\{.+\}$/;
  return bracesPattern.test(query);
}

// Pattern for testing regex
export const regexPattern = /^\/(.*)\/([gmi]*)$/m;

export function isRegex(str) {
  return regexPattern.test(str);
}

export function isTemplateVariable(str, templateVariables) {
  const variablePattern = /^\$\w+/;
  if (variablePattern.test(str)) {
    const variables = _.map(templateVariables, variable => {
      return '$' + variable.name;
    });
    return _.includes(variables, str);
  } else {
    return false;
  }
}

export function getRangeScopedVars(range) {
  const msRange = range.to.diff(range.from);
  const sRange = Math.round(msRange / 1000);
  const regularRange = rangeUtil.secondsToHms(msRange / 1000);
  return {
    __range_ms: { text: msRange, value: msRange },
    __range_s: { text: sRange, value: sRange },
    __range: { text: regularRange, value: regularRange },
    __range_series: {text: c.RANGE_VARIABLE_VALUE, value: c.RANGE_VARIABLE_VALUE},
  };
}

export function buildRegex(str) {
  const matches = str.match(regexPattern);
  const pattern = matches[1];
  const flags = matches[2] !== "" ? matches[2] : undefined;
  return new RegExp(pattern, flags);
}

// Need for template variables replace
// From Grafana's templateSrv.js
export function escapeRegex(value) {
  return value.replace(/[\\^$*+?.()|[\]{}\/]/g, '\\$&');
}

/**
 * Parses Zabbix item update interval. Returns 0 in case of custom intervals.
 */
export function parseItemInterval(interval: string): number {
  const normalizedInterval = normalizeZabbixInterval(interval);
  if (normalizedInterval) {
    return parseInterval(normalizedInterval);
  }
  return 0;
}

export function normalizeZabbixInterval(interval: string): string {
  const intervalPattern = /(^[\d]+)(y|M|w|d|h|m|s)?/g;
  const parsedInterval = intervalPattern.exec(interval);
  if (!parsedInterval || !interval || (parsedInterval.length > 2 && !parsedInterval[2])) {
    return '';
  }
  return parsedInterval[1] + (parsedInterval.length > 2 ? parsedInterval[2] : 's');
}

export function parseInterval(interval: string): number {
  const intervalPattern = /(^[\d]+)(y|M|w|d|h|m|s)/g;
  const momentInterval: any[] = intervalPattern.exec(interval);
  const duration = moment.duration(Number(momentInterval[1]), momentInterval[2]);
  return (duration.valueOf() as number);
}

export function parseTimeShiftInterval(interval) {
  const intervalPattern = /^([\+\-]*)([\d]+)(y|M|w|d|h|m|s)/g;
  const momentInterval: any[] = intervalPattern.exec(interval);
  let duration: any = 0;

  if (momentInterval[1] === '+') {
    duration = 0 - (moment.duration(Number(momentInterval[2]), momentInterval[3]).valueOf() as any);
  } else {
    duration = moment.duration(Number(momentInterval[2]), momentInterval[3]).valueOf();
  }

  return duration;
}

/**
 * Format acknowledges.
 *
 * @param  {array} acknowledges array of Zabbix acknowledge objects
 * @return {string} HTML-formatted table
 */
export function formatAcknowledges(acknowledges) {
  if (acknowledges.length) {
    let formatted_acknowledges = '<br><br>Acknowledges:<br><table><tr><td><b>Time</b></td>'
      + '<td><b>User</b></td><td><b>Comments</b></td></tr>';
    _.each(_.map(acknowledges, ack => {
      const timestamp = moment.unix(ack.clock);
      return '<tr><td><i>' + timestamp.format("DD MMM YYYY HH:mm:ss") + '</i></td><td>' + ack.alias
        + ' (' + ack.name + ' ' + ack.surname + ')' + '</td><td>' + ack.message + '</td></tr>';
    }), ack => {
      formatted_acknowledges = formatted_acknowledges.concat(ack);
    });
    formatted_acknowledges = formatted_acknowledges.concat('</table>');
    return formatted_acknowledges;
  } else {
    return '';
  }
}

export function convertToZabbixAPIUrl(url) {
  const zabbixAPIUrlPattern = /.*api_jsonrpc.php$/;
  const trimSlashPattern = /(.*?)[\/]*$/;
  if (url.match(zabbixAPIUrlPattern)) {
    return url;
  } else {
    return url.replace(trimSlashPattern, "$1");
  }
}

/**
 * Wrap function to prevent multiple calls
 * when waiting for result.
 */
export function callOnce(func, promiseKeeper) {
  return function() {
    if (!promiseKeeper) {
      promiseKeeper = Promise.resolve(
        func.apply(this, arguments)
        .then(result => {
          promiseKeeper = null;
          return result;
        }).catch(err => {
          promiseKeeper = null;
          throw err;
        })
      );
    }
    return promiseKeeper;
  };
}

/**
 * Apply function one by one: `sequence([a(), b(), c()]) = c(b(a()))`
 * @param {*} funcsArray functions to apply
 */
export function sequence(funcsArray) {
  return function(result) {
    for (let i = 0; i < funcsArray.length; i++) {
      result = funcsArray[i].call(this, result);
    }
    return result;
  };
}

const versionPattern = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z\.]+))?/;

export function isValidVersion(version) {
  return versionPattern.exec(version);
}

export function parseVersion(version: string) {
  const match = versionPattern.exec(version);
  if (!match) {
    return null;
  }
  const major = Number(match[1]);
  const minor = Number(match[2] || 0);
  const patch = Number(match[3] || 0);
  const meta = match[4];
  return { major, minor, patch, meta };
}

/**
 * Replaces any space-like symbols (tabs, new lines, spaces) by single whitespace.
 */
export function compactQuery(query) {
  return query.replace(/\s+/g, ' ').trim();
}

export function getArrayDepth(a, level = 0) {
  if (a.length === 0) {
    return 1;
  }
  const elem = a[0];
  if (_.isArray(elem)) {
    return getArrayDepth(elem, level + 1);
  }
  return level + 1;
}

/**
 * Checks whether its argument represents a numeric value.
 */
export function isNumeric(n: any): boolean {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 * Parses tags string into array of {tag: value} objects
 */
export function parseTags(tagStr: string): any[] {
  if (!tagStr) {
    return [];
  }

  let tags: any[] = _.map(tagStr.split(','), (tag) => tag.trim());
  tags = _.map(tags, (tag) => {
    const tagParts = tag.split(':');
    return {tag: tagParts[0].trim(), value: tagParts[1].trim()};
  });
  return tags;
}

export function mustArray(result: any): any[] {
  return result || [];
}

const getUnitsMap = () => ({
  '%': 'percent',
  'b': 'decbits', // bits(SI)
  'bps': 'bps', // bits/sec(SI)
  'B': 'bytes', // bytes(IEC)
  'Bps': 'binBps', // bytes/sec(IEC)
  // 'unixtime': 'dateTimeAsSystem',
  'uptime': 'dtdhms',
  'qps': 'qps', // requests/sec (rps)
  'iops': 'iops', // I/O ops/sec (iops)
  'Hz': 'hertz', // Hertz (1/s)
  'V': 'volt', // Volt (V)
  'C': 'celsius', // Celsius (°C)
  'RPM': 'rotrpm', // Revolutions per minute (rpm)
  'dBm': 'dBm', // Decibel-milliwatt (dBm)
});

const getKnownGrafanaUnits = () => {
  const units = {};
  const categories = getValueFormats();
  for (const category of categories) {
    for (const unitDesc of category.submenu) {
      const unit = unitDesc.value;
      units[unit] = unit;
    }
  }
  return units;
};

const unitsMap = getUnitsMap();
const knownGrafanaUnits = getKnownGrafanaUnits();

export function convertZabbixUnit(zabbixUnit: string): string {
  let unit = unitsMap[zabbixUnit];
  if (!unit) {
    unit = knownGrafanaUnits[zabbixUnit];
  }
  return unit;
}

export function getValueMapping(item, valueMappings: any[]): ValueMapping[] | null {
  const { valuemapid } = item;
  const mapping = valueMappings?.find(m => m.valuemapid === valuemapid);
  if (!mapping) {
    return null;
  }

  return (mapping.mappings as any[]).map((m, i) => {
    const valueMapping: ValueMapping = {
      id: i,
      type: MappingType.ValueToText,
      value: m.value,
      text: m.newvalue,
    };
    return valueMapping;
  });
}

export function isProblemsDataFrame(data: DataFrame): boolean {
  return data.fields.length && data.fields[0].type === FieldType.other && data.fields[0].config.custom['type'] === 'problems';
}
