import _ from 'lodash';
import { ZabbixMetricsQuery } from './types';
import * as c from './constants';

/**
 * Query format migration.
 * This module can detect query format version and make migration.
 */

export function isGrafana2target(target) {
  if (!target.mode || target.mode === 0 || target.mode === 2) {
    if ((target.hostFilter || target.itemFilter || target.downsampleFunction ||
        (target.host && target.host.host)) &&
        (target.item.filter === undefined && target.host.filter === undefined)) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

export function migrateFrom2To3version(target: ZabbixMetricsQuery) {
  target.group.filter = target.group.name === "*" ? "/.*/" : target.group.name;
  target.host.filter = target.host.name === "*" ? convertToRegex(target.hostFilter) : target.host.name;
  target.application.filter = target.application.name === "*" ? "" : target.application.name;
  target.item.filter = target.item.name === "All" ? convertToRegex(target.itemFilter) : target.item.name;
  return target;
}

function migratePercentileAgg(target) {
  if (target.functions) {
    for (const f of target.functions) {
      if (f.def && f.def.name === 'percentil') {
        f.def.name = 'percentile';
      }
    }
  }
}

function migrateQueryType(target) {
  if (target.queryType === undefined) {
    if (target.mode === 'Metrics') {
      // Explore mode
      target.queryType = c.MODE_METRICS;
    } else if (target.mode !== undefined) {
      target.queryType = target.mode;
      delete target.mode;
    }
  }
}

function migrateSLA(target) {
  if (target.queryType === c.MODE_ITSERVICE && !target.slaInterval) {
    target.slaInterval = 'none';
  }
}

function migrateProblemSort(target) {
  if (target.options?.sortProblems === 'priority') {
    target.options.sortProblems = 'severity';
  }
}

export function migrate(target) {
  target.resultFormat = target.resultFormat || 'time_series';
  target = fixTargetGroup(target);
  if (isGrafana2target(target)) {
    return migrateFrom2To3version(target);
  }
  migratePercentileAgg(target);
  migrateQueryType(target);
  migrateSLA(target);
  migrateProblemSort(target);
  return target;
}

function fixTargetGroup(target) {
  if (target.group && Array.isArray(target.group)) {
    target.group = { 'filter': "" };
  }
  return target;
}

function convertToRegex(str) {
  if (str) {
    return '/' + str + '/';
  } else {
    return '/.*/';
  }
}

export const DS_CONFIG_SCHEMA = 2;
export function migrateDSConfig(jsonData) {
  if (!jsonData) {
    jsonData = {};
  }

  if (!shouldMigrateDSConfig(jsonData)) {
    return jsonData;
  }

  const oldVersion = jsonData.schema || 1;
  jsonData.schema = DS_CONFIG_SCHEMA;

  if (oldVersion < 2) {
    const dbConnectionOptions = jsonData.dbConnection || {};
    jsonData.dbConnectionEnable = dbConnectionOptions.enable || false;
    jsonData.dbConnectionDatasourceId = dbConnectionOptions.datasourceId || null;
    delete jsonData.dbConnection;
  }

  return jsonData;
}

function shouldMigrateDSConfig(jsonData): boolean {
  if (jsonData.dbConnection && !_.isEmpty(jsonData.dbConnection)) {
    return true;
  }
  if (jsonData.schema && jsonData.schema !== DS_CONFIG_SCHEMA) {
    return true;
  }
  return false;
}
