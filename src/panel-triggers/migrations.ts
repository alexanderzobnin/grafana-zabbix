import _ from 'lodash';
import { getNextRefIdChar } from './utils';
import { ShowProblemTypes } from '../datasource-zabbix/types';

// Actual schema version
export const CURRENT_SCHEMA_VERSION = 8;

export const getDefaultTarget = (targets?) => {
  return {
    group: {filter: ""},
    host: {filter: ""},
    application: {filter: ""},
    trigger: {filter: ""},
    tags: {filter: ""},
    proxy: {filter: ""},
    refId: getNextRefIdChar(targets),
  };
};

export function getDefaultTargetOptions() {
  return {
    hostsInMaintenance: true,
  };
}

export function migratePanelSchema(panel) {
  if (isDefaultPanel(panel)) {
    return panel;
  }

  if (isEmptyPanel(panel)) {
    delete panel.targets;
    return panel;
  }

  const schemaVersion = getSchemaVersion(panel);
  // panel.schemaVersion = CURRENT_SCHEMA_VERSION;

  if (schemaVersion < 2) {
    panel.datasources = [panel.datasource];
    panel.targets = {};
    panel.targets[panel.datasources[0]] = panel.triggers;

    // delete old props
    delete panel.triggers;
    delete panel.datasource;
  }

  if (schemaVersion < 3) {
    // delete old props
    delete panel.lastChangeField;
    delete panel.infoField;
    delete panel.scroll;
    delete panel.hideHostsInMaintenance;
  }

  if (schemaVersion < 5) {
    if (panel.targets && !_.isEmpty(panel.targets)) {
      _.each(panel.targets, (target) => {
        _.defaultsDeep(target, getDefaultTarget());
      });
    }
  }

  if (schemaVersion < 6) {
    if (panel.showEvents && panel.showEvents.value === '1') {
      panel.showEvents.value = 1;
    }
  }

  if (schemaVersion < 7) {
    const updatedTargets = [];
    for (const targetKey in panel.targets) {
      const target = panel.targets[targetKey];
      if (!isEmptyTarget(target) && !isInvalidTarget(target, targetKey)) {
        updatedTargets.push({
          ...target,
          datasource: targetKey,
        });
      }
    }
    for (const target of updatedTargets) {
      if (!target.refId) {
        target.refId = getNextRefIdChar(updatedTargets);
      }
    }
    panel.targets = updatedTargets;
    delete panel.datasources;
  }

  if (schemaVersion < 8) {
    if (panel.targets.length === 1) {
      if (panel.targets[0].datasource) {
        panel.datasource = panel.targets[0].datasource;
        delete panel.targets[0].datasource;
      }
    } else if (panel.targets.length > 1) {
      // Mixed data sources
      panel.datasource = '-- Mixed --';
    }
    for (const target of panel.targets) {
      // set queryType to PROBLEMS
      target.queryType = 5;
      target.showProblems = migrateShowEvents(panel);
      target.options = migrateOptions(panel);

      _.defaults(target.options, getDefaultTargetOptions());
      _.defaults(target, { tags: { filter: "" } });
    }

    panel.sortProblems = panel.sortTriggersBy?.value === 'priority' ? 'priority' : 'lastchange';

    delete panel.showEvents;
    delete panel.showTriggers;
    delete panel.hostsInMaintenance;
    delete panel.sortTriggersBy;
  }

  return panel;
}

function migrateOptions(panel) {
  let acknowledged = 2;
  if (panel.showTriggers === 'acknowledged') {
    acknowledged = 1;
  } else if (panel.showTriggers === 'unacknowledged') {
    acknowledged = 0;
  }

  // Default limit in Zabbix
  let limit = 1001;
  if (panel.limit && panel.limit !== 100) {
    limit = panel.limit;
  }

  return {
    hostsInMaintenance: panel.hostsInMaintenance,
    sortProblems: panel.sortTriggersBy?.value === 'priority' ? 'priority' : 'default',
    minSeverity: 0,
    acknowledged: acknowledged,
    limit: limit,
  };
}

function migrateShowEvents(panel) {
  if (panel.showEvents?.value === 1) {
    return ShowProblemTypes.Problems;
  } else if (panel.showEvents?.value === 0 || panel.showEvents?.value?.length > 1) {
    return ShowProblemTypes.History;
  } else {
    return ShowProblemTypes.Problems;
  }
}

function getSchemaVersion(panel) {
  return panel.schemaVersion || 1;
}

function isEmptyPanel(panel) {
  return !panel.datasource && !panel.datasources && !panel.triggers && isEmptyTargets(panel.targets);
}

function isEmptyTargets(targets) {
  return !targets || (_.isArray(targets) && (targets.length === 0 || targets.length === 1 && _.isEmpty(targets[0])));
}

function isDefaultPanel(panel) {
  return panel.targets && panel.targets.length === 1 && isDefaultTarget(panel.targets[0]);
}

function isDefaultTarget(target) {
  return !target.group?.filter && !target.host?.filter && !target.application?.filter && !target.trigger?.filter && !target.queryType;
}

function isEmptyTarget(target) {
  return !target || !(target.group && target.host && target.application && target.trigger);
}

function isInvalidTarget(target, targetKey) {
  return target && target.refId === 'A' && targetKey === '0';
}
