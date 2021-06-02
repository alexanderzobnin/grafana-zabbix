import _ from 'lodash';
import * as utils from '../datasource-zabbix/utils';
import { DataFrame, Field, FieldType, ArrayVector } from '@grafana/data';
import { ZBXProblem, ZBXTrigger, ProblemDTO, ZBXEvent } from './types';

export function joinTriggersWithProblems(problems: ZBXProblem[], triggers: ZBXTrigger[]): ProblemDTO[] {
  const problemDTOList: ProblemDTO[] = [];

  for (let i = 0; i < problems.length; i++) {
    const p = problems[i];
    const triggerId = Number(p.objectid);
    const t = triggers[triggerId];

    if (t) {
      const problemDTO: ProblemDTO = {
        timestamp: Number(p.clock),
        triggerid: p.objectid,
        eventid: p.eventid,
        name: p.name,
        severity: p.severity,
        acknowledged: p.acknowledged,
        acknowledges: p.acknowledges,
        tags: p.tags,
        suppressed: p.suppressed,
        suppression_data: p.suppression_data,
        description: t.description,
        comments: t.comments,
        value: t.value,
        groups: t.groups,
        hosts: t.hosts,
        items: t.items,
        alerts: t.alerts,
        url: t.url,
        expression: t.expression,
        correlation_mode: t.correlation_mode,
        correlation_tag: t.correlation_tag,
        manual_close: t.manual_close,
        state: t.state,
        error: t.error,
      };

      problemDTOList.push(problemDTO);
    }

  }

  return problemDTOList;
}

interface JoinOptions {
  valueFromEvent?: boolean;
}

export function joinTriggersWithEvents(events: ZBXEvent[], triggers: ZBXTrigger[], options?: JoinOptions): ProblemDTO[] {
  const { valueFromEvent } = options;
  const problemDTOList: ProblemDTO[] = [];

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const triggerId = Number(e.objectid);
    const t = triggers[triggerId];

    if (t) {
      const problemDTO: ProblemDTO = {
        value: valueFromEvent ? e.value : t.value,
        timestamp: Number(e.clock),
        triggerid: e.objectid,
        eventid: e.eventid,
        name: e.name,
        severity: e.severity,
        acknowledged: e.acknowledged,
        acknowledges: e.acknowledges,
        tags: e.tags,
        suppressed: e.suppressed,
        description: t.description,
        comments: t.comments,
        groups: t.groups,
        hosts: t.hosts,
        items: t.items,
        alerts: t.alerts,
        url: t.url,
        expression: t.expression,
        correlation_mode: t.correlation_mode,
        correlation_tag: t.correlation_tag,
        manual_close: t.manual_close,
        state: t.state,
        error: t.error,
      };

      problemDTOList.push(problemDTO);
    }

  }

  return problemDTOList;
}

export function setMaintenanceStatus(triggers) {
  _.each(triggers, (trigger) => {
    const maintenance_status = _.some(trigger.hosts, (host) => host.maintenance_status === '1');
    trigger.maintenance = maintenance_status;
  });
  return triggers;
}

export function setAckButtonStatus(triggers, showAckButton) {
  _.each(triggers, (trigger) => {
    trigger.showAckButton = showAckButton;
  });
  return triggers;
}

export function addTriggerDataSource(triggers, target) {
  _.each(triggers, (trigger) => {
    trigger.datasource = target.datasource;
  });
  return triggers;
}

export function addTriggerHostProxy(triggers, proxies) {
  triggers.forEach(trigger => {
    if (trigger.hosts && trigger.hosts.length) {
      const host = trigger.hosts[0];
      if (host.proxy_hostid !== '0') {
        const hostProxy = proxies[host.proxy_hostid];
        host.proxy = hostProxy ? hostProxy.host : '';
      }
    }
  });
  return triggers;
}

export function filterTriggersPre(triggerList, replacedTarget) {
  // Filter triggers by description
  const triggerFilter = replacedTarget.trigger.filter;
  if (triggerFilter) {
    triggerList = filterTriggers(triggerList, triggerFilter);
  }

  // Filter by maintenance status
  if (!replacedTarget.options.hostsInMaintenance) {
    triggerList = _.filter(triggerList, (trigger) => !trigger.maintenance);
  }

  return triggerList;
}

function filterTriggers(triggers, triggerFilter) {
  if (utils.isRegex(triggerFilter)) {
    return _.filter(triggers, trigger => {
      return utils.buildRegex(triggerFilter).test(trigger.description);
    });
  } else {
    return _.filter(triggers, trigger => {
      return trigger.description === triggerFilter;
    });
  }
}

export function sortProblems(problems: ProblemDTO[], target) {
  if (target.options?.sortProblems === 'severity') {
    problems = _.orderBy(problems, ['severity', 'eventid'], ['desc', 'desc']);
  } else if (target.options?.sortProblems === 'lastchange') {
    problems = _.orderBy(problems, ['timestamp', 'eventid'], ['desc', 'desc']);
  }
  return problems;
}

export function toDataFrame(problems: any[]): DataFrame {
  const problemsField: Field<any> = {
    name: 'Problems',
    type: FieldType.other,
    values: new ArrayVector(problems),
    config: {
      custom: {
        type: 'problems',
      },
    },
  };

  const response: DataFrame = {
    name: 'problems',
    fields: [problemsField],
    length: problems.length,
  };

  return response;
}

const problemsHandler = {
  addTriggerDataSource,
  addTriggerHostProxy,
  setMaintenanceStatus,
  setAckButtonStatus,
  filterTriggersPre,
  sortProblems,
  toDataFrame,
  joinTriggersWithProblems,
  joinTriggersWithEvents,
};

export default problemsHandler;
