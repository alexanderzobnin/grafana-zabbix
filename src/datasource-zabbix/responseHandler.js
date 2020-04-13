import _ from 'lodash';
import TableModel from 'grafana/app/core/table_model';
import * as c from './constants';

/**
 * Convert Zabbix API history.get response to Grafana format
 *
 * @return {Array}            Array of timeseries in Grafana format
 *                            {
 *                               target: "Metric name",
 *                               datapoints: [[<value>, <unixtime>], ...]
 *                            }
 */
function convertHistory(history, items, addHostName, convertPointCallback) {
  /**
   * Response should be in the format:
   * data: [
   *          {
   *             target: "Metric name",
   *             datapoints: [[<value>, <unixtime>], ...]
   *          }, ...
   *       ]
   */

  // Group history by itemid
  var grouped_history = _.groupBy(history, 'itemid');
  var hosts = _.uniqBy(_.flatten(_.map(items, 'hosts')), 'hostid');  //uniqBy is needed to deduplicate

  return _.map(grouped_history, function(hist, itemid) {
    var item = _.find(items, {'itemid': itemid});
    var alias = item.name;
    if (_.keys(hosts).length > 1 && addHostName) {   //only when actual multi hosts selected
      var host = _.find(hosts, {'hostid': item.hostid});
      alias = host.name + ": " + alias;
    }
    return {
      target: alias,
      datapoints: _.map(hist, convertPointCallback)
    };
  });
}

function sortTimeseries(timeseries) {
  // Sort trend data, issue #202
  _.forEach(timeseries, series => {
    series.datapoints = _.sortBy(series.datapoints, point => point[c.DATAPOINT_TS]);
  });
  return timeseries;
}

function handleHistory(history, items, addHostName = true) {
  return convertHistory(history, items, addHostName, convertHistoryPoint);
}

function handleTrends(history, items, valueType, addHostName = true) {
  var convertPointCallback = _.partial(convertTrendPoint, valueType);
  return convertHistory(history, items, addHostName, convertPointCallback);
}

function handleText(history, items, target, addHostName = true) {
  let convertTextCallback = _.partial(convertText, target);
  return convertHistory(history, items, addHostName, convertTextCallback);
}

function handleHistoryAsTable(history, items, target) {
  let table = new TableModel();
  table.addColumn({text: 'Host'});
  table.addColumn({text: 'Item'});
  table.addColumn({text: 'Key'});
  table.addColumn({text: 'Last value'});

  let grouped_history = _.groupBy(history, 'itemid');
  _.each(items, (item) => {
    let itemHistory = grouped_history[item.itemid] || [];
    let lastPoint = _.last(itemHistory);
    let lastValue = lastPoint ? lastPoint.value : null;

    if(target.options.skipEmptyValues && (!lastValue || lastValue === '')) {
      return;
    }

    // Regex-based extractor
    if (target.textFilter) {
      lastValue = extractText(lastValue, target.textFilter, target.useCaptureGroups);
    }

    let host = _.first(item.hosts);
    host = host ? host.name : "";

    table.rows.push([
      host, item.name, item.key_, lastValue
    ]);
  });

  return table;
}

function convertText(target, point) {
  let value = point.value;

  // Regex-based extractor
  if (target.textFilter) {
    value = extractText(point.value, target.textFilter, target.useCaptureGroups);
  }

  return [
    value,
    point.clock * 1000 + Math.round(point.ns / 1000000)
  ];
}

function extractText(str, pattern, useCaptureGroups) {
  let extractPattern = new RegExp(pattern);
  let extractedValue = extractPattern.exec(str);
  if (extractedValue) {
    if (useCaptureGroups) {
      extractedValue = extractedValue[1];
    } else {
      extractedValue = extractedValue[0];
    }
  }
  return extractedValue;
}

function handleSLAResponse(itservice, slaProperty, slaObject) {
  var targetSLA = slaObject[itservice.serviceid].sla;
  if (slaProperty.property === 'status') {
    var targetStatus = parseInt(slaObject[itservice.serviceid].status);
    return {
      target: itservice.name + ' ' + slaProperty.name,
      datapoints: [
        [targetStatus, targetSLA[0].to * 1000]
      ]
    };
  } else {
    let i;
    let slaArr = [];
    for (i = 0; i < targetSLA.length; i++) {
      if (i === 0) {
        slaArr.push([targetSLA[i][slaProperty.property], targetSLA[i].from * 1000]);
      }
      slaArr.push([targetSLA[i][slaProperty.property], targetSLA[i].to * 1000]);
    }
    return {
      target: itservice.name + ' ' + slaProperty.name,
      datapoints: slaArr
    };
  }
}

function handleTriggersResponse(triggers, groups, timeRange) {
  if (!_.isArray(triggers)) {
    let triggersCount = null;
    try {
      triggersCount = Number(triggers);
    } catch (err) {
      console.log("Error when handling triggers count: ", err);
    }
    return {
      target: "triggers count",
      datapoints: [
        [triggersCount, timeRange[1] * 1000]
      ]
    };
  } else {
    const stats = getTriggerStats(triggers);
    const groupNames = _.map(groups, 'name');
    let table = new TableModel();
    table.addColumn({text: 'Host group'});
    _.each(_.orderBy(c.TRIGGER_SEVERITY, ['val'], ['desc']), (severity) => {
      table.addColumn({text: severity.text});
    });
    _.each(stats, (severity_stats, group) => {
      if (_.includes(groupNames, group)) {
        let row = _.map(_.orderBy(_.toPairs(severity_stats), (s) => s[0], ['desc']), (s) => s[1]);
        row = _.concat([group], ...row);
        table.rows.push(row);
      }
    });
    return table;
  }
}

function handleMapsResponse(zbxmap, queryType) {
  let table = new TableModel();
  if (queryType === "properties") {
    console.debug('Filling map properties');
    table.addColumn({text: 'map.id'});
    table.addColumn({text: 'map.name'});
    table.addColumn({text: 'map.w'});
    table.addColumn({text: 'map.h'});
    table.addColumn({text: 'map.bg'});
    table.rows.push([zbxmap.sysmapid, zbxmap.name, zbxmap.width, zbxmap.height, zbxmap.backgroundid]);
  } else if (queryType === "elements") {
    console.debug('Filling elements');
    table.addColumn({text: 'element.id'});
    table.addColumn({text: 'element.mapid'});
    table.addColumn({text: 'element.type'});
    table.addColumn({text: 'element.label'});
    table.addColumn({text: 'element.x'});
    table.addColumn({text: 'element.y'});
    _.each(zbxmap.selements, function (selement) {
      let row = [
        selement.selementid, selement.sysmapid, selement.elementtype, selement.label, selement.x, selement.y
      ];
      table.rows.push(row);
    });
  } else if (queryType === "links") {
    console.debug('Filling links');

  }
  console.debug('Table for ' + queryType + ': ', table);
  return table;
}

function getTriggerStats(triggers) {
  let groups = _.uniq(_.flattenDeep(_.map(triggers, (trigger) => _.map(trigger.groups, 'name'))));
  // let severity = _.map(c.TRIGGER_SEVERITY, 'text');
  let stats = {};
  _.each(groups, (group) => {
    stats[group] = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0}; // severity:count
  });
  _.each(triggers, (trigger) => {
    _.each(trigger.groups, (group) => {
      stats[group.name][trigger.priority]++;
    });
  });
  return stats;
}

function convertHistoryPoint(point) {
  // Value must be a number for properly work
  return [
    Number(point.value),
    point.clock * 1000 + Math.round(point.ns / 1000000)
  ];
}

function convertTrendPoint(valueType, point) {
  var value;
  switch (valueType) {
    case "min":
      value = point.value_min;
      break;
    case "max":
      value = point.value_max;
      break;
    case "avg":
      value = point.value_avg;
      break;
    case "sum":
      value = point.value_sum;
      break;
    case "count":
      value = point.value_count;
      break;
    default:
      value = point.value_avg;
  }

  return [
    Number(value),
    point.clock * 1000
  ];
}

export default {
  handleHistory,
  convertHistory,
  handleTrends,
  handleText,
  handleHistoryAsTable,
  handleSLAResponse,
  handleTriggersResponse,
  handleMapsResponse,
  sortTimeseries
};

// Fix for backward compatibility with lodash 2.4
if (!_.uniqBy) {_.uniqBy = _.uniq;}
