import React from 'react';
import ReactDOM from 'react-dom';
import _ from 'lodash';
import { getDataSourceSrv } from '@grafana/runtime';
import { PanelEvents } from '@grafana/data';
import * as dateMath from 'grafana/app/core/utils/datemath';
import * as utils from '../datasource-zabbix/utils';
import { MetricsPanelCtrl } from 'grafana/app/plugins/sdk';
import { triggerPanelOptionsTab } from './options_tab';
import { migratePanelSchema, CURRENT_SCHEMA_VERSION } from './migrations';
import ProblemList from './components/Problems/Problems';
import AlertList from './components/AlertList/AlertList';
import { ProblemDTO } from 'datasource-zabbix/types';

const PROBLEM_EVENTS_LIMIT = 100;

export const DEFAULT_TARGET = {
  group: {filter: ""},
  host: {filter: ""},
  application: {filter: ""},
  trigger: {filter: ""},
  tags: {filter: ""},
  proxy: {filter: ""},
  showProblems: 'problems',
};

export const DEFAULT_SEVERITY = [
  { priority: 0, severity: 'Not classified',  color: 'rgb(108, 108, 108)', show: true},
  { priority: 1, severity: 'Information',     color: 'rgb(120, 158, 183)', show: true},
  { priority: 2, severity: 'Warning',         color: 'rgb(175, 180, 36)', show: true},
  { priority: 3, severity: 'Average',         color: 'rgb(255, 137, 30)', show: true},
  { priority: 4, severity: 'High',            color: 'rgb(255, 101, 72)', show: true},
  { priority: 5, severity: 'Disaster',        color: 'rgb(215, 0, 0)', show: true},
];

export const getDefaultSeverity = () => DEFAULT_SEVERITY;

const DEFAULT_TIME_FORMAT = "DD MMM YYYY HH:mm:ss";

export const PANEL_DEFAULTS = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  targets: [{}],
  // Fields
  hostField: true,
  hostTechNameField: false,
  hostProxy: false,
  hostGroups: false,
  showTags: true,
  statusField: true,
  statusIcon: false,
  severityField: true,
  ackField: true,
  ageField: false,
  descriptionField: true,
  descriptionAtNewLine: false,
  // Options
  sortProblems: 'lastchange',
  limit: null,
  // View options
  layout: 'table',
  fontSize: '100%',
  pageSize: 10,
  problemTimeline: true,
  highlightBackground: false,
  highlightNewEvents: false,
  highlightNewerThan: '1h',
  customLastChangeFormat: false,
  lastChangeFormat: "",
  resizedColumns: [],
  // Triggers severity and colors
  triggerSeverity: getDefaultSeverity(),
  okEventColor: 'rgb(56, 189, 113)',
  ackEventColor: 'rgb(56, 219, 156)',
  markAckEvents: false,
};

const triggerStatusMap = {
  '0': 'OK',
  '1': 'PROBLEM'
};

export class TriggerPanelCtrl extends MetricsPanelCtrl {
  scope: any;
  useDataFrames: boolean;
  triggerStatusMap: any;
  defaultTimeFormat: string;
  pageIndex: number;
  renderData: any[];
  problems: any[];
  contextSrv: any;
  static templateUrl: string;

  /** @ngInject */
  constructor($scope, $injector, $timeout) {
    super($scope, $injector);
    this.scope = $scope;
    this.$timeout = $timeout;

    // Tell Grafana do not convert data frames to table or series
    this.useDataFrames = true;

    this.triggerStatusMap = triggerStatusMap;
    this.defaultTimeFormat = DEFAULT_TIME_FORMAT;
    this.pageIndex = 0;
    this.range = {};
    this.renderData = [];

    this.panel = migratePanelSchema(this.panel);
    _.defaultsDeep(this.panel, _.cloneDeep(PANEL_DEFAULTS));

    // this.events.on(PanelEvents.render, this.onRender.bind(this));
    this.events.on('data-frames-received', this.onDataFramesReceived.bind(this));
    this.events.on(PanelEvents.dataSnapshotLoad, this.onDataSnapshotLoad.bind(this));
    this.events.on(PanelEvents.editModeInitialized, this.onInitEditMode.bind(this));
  }

  onInitEditMode() {
    // Update schema version to prevent migration on up-to-date targets
    this.panel.schemaVersion = CURRENT_SCHEMA_VERSION;
    this.addEditorTab('Options', triggerPanelOptionsTab);
  }

  onDataFramesReceived(data: any): Promise<any> {
    this.range = this.timeSrv.timeRange();
    let problems = [];

    if (data && data.length) {
      for (const dataFrame of data) {
        try {
          const values = dataFrame.fields[0].values;
          if (values.toArray) {
            problems.push(values.toArray());
          } else if (values.length > 0) {
            // On snapshot mode values is a plain Array, not ArrayVector
            problems.push(values);
          }
        } catch (error) {
          console.log(error);
          return Promise.reject(error);
        }
      }
    }

    this.loading = false;
    problems = _.flatten(problems);
    this.problems = problems;
    return this.renderProblems(problems);
  }

  onDataSnapshotLoad(snapshotData) {
    return this.onDataFramesReceived(snapshotData);
  }

  reRenderProblems() {
    if (this.problems) {
      this.renderProblems(this.problems);
    }
  }

  setPanelError(err, defaultError = "Request Error") {
    this.inspector = { error: err };
    this.error = err.message || defaultError;
    if (err.data) {
      if (err.data.message) {
        this.error = err.data.message;
      }
      if (err.data.error) {
        this.error = err.data.error;
      }
    }

    // this.events.emit(PanelEvents.dataError, err);
    console.log('Panel data error:', err);
  }

  renderProblems(problems) {
    let triggers = _.cloneDeep(problems);

    triggers = _.map(triggers, this.formatTrigger.bind(this));
    triggers = this.filterProblems(triggers);
    triggers = this.sortTriggers(triggers);

    this.renderData = triggers;

    return this.$timeout(() => {
      return super.render(triggers);
    });
  }

  filterProblems(problems) {
    let problemsList = _.cloneDeep(problems);

    // Filter acknowledged triggers
    if (this.panel.showTriggers === 'unacknowledged') {
      problemsList = _.filter(problemsList, trigger => {
        return !(trigger.acknowledges && trigger.acknowledges.length);
      });
    } else if (this.panel.showTriggers === 'acknowledged') {
      problemsList = _.filter(problemsList, trigger => {
        return trigger.acknowledges && trigger.acknowledges.length;
      });
    }

    // Filter triggers by severity
    problemsList = _.filter(problemsList, problem => {
      if (problem.severity) {
        return this.panel.triggerSeverity[problem.severity].show;
      } else {
        return this.panel.triggerSeverity[problem.priority].show;
      }
    });

    return problemsList;
  }

  sortTriggers(problems: ProblemDTO[]) {
    if (this.panel.sortProblems === 'priority') {
      problems = _.orderBy(problems, ['severity', 'timestamp', 'eventid'], ['desc', 'desc', 'desc']);
    } else if (this.panel.sortProblems === 'lastchange') {
      problems = _.orderBy(problems, ['timestamp', 'severity', 'eventid'], ['desc', 'desc', 'desc']);
    }
    return problems;
  }

  formatTrigger(zabbixTrigger) {
    const trigger = _.cloneDeep(zabbixTrigger);

    // Set host and proxy that the trigger belongs
    if (trigger.hosts && trigger.hosts.length) {
      const host = trigger.hosts[0];
      trigger.host = host.name;
      trigger.hostTechName = host.host;
      if (host.proxy) {
        trigger.proxy = host.proxy;
      }
    }

    // Set tags if present
    if (trigger.tags && trigger.tags.length === 0) {
      trigger.tags = null;
    }

    // Handle multi-line description
    if (trigger.comments) {
      trigger.comments = trigger.comments.replace('\n', '<br>');
    }

    trigger.lastchangeUnix = Number(trigger.lastchange);
    return trigger;
  }

  parseTags(tagStr) {
    if (!tagStr) {
      return [];
    }

    let tags = _.map(tagStr.split(','), (tag) => tag.trim());
    tags = _.map(tags, (tag) => {
      const tagParts = tag.split(':');
      return {tag: tagParts[0].trim(), value: tagParts[1].trim()};
    });
    return tags;
  }

  tagsToString(tags) {
    return _.map(tags, (tag) => `${tag.tag}:${tag.value}`).join(', ');
  }

  addTagFilter(tag, datasource) {
    for (const target of this.panel.targets) {
      if (target.datasource === datasource || this.panel.datasource === datasource) {
        const tagFilter = target.tags.filter;
        let targetTags = this.parseTags(tagFilter);
        const newTag = {tag: tag.tag, value: tag.value};
        targetTags.push(newTag);
        targetTags = _.uniqWith(targetTags, _.isEqual);
        const newFilter = this.tagsToString(targetTags);
        target.tags.filter = newFilter;
      }
    }
    this.refresh();
  }

  removeTagFilter(tag, datasource) {
    const matchTag = t => t.tag === tag.tag && t.value === tag.value;
    for (const target of this.panel.targets) {
      if (target.datasource === datasource || this.panel.datasource === datasource) {
        const tagFilter = target.tags.filter;
        let targetTags = this.parseTags(tagFilter);
        _.remove(targetTags, matchTag);
        targetTags = _.uniqWith(targetTags, _.isEqual);
        const newFilter = this.tagsToString(targetTags);
        target.tags.filter = newFilter;
      }
    }
    this.refresh();
  }

  getProblemEvents(problem) {
    const triggerids = [problem.triggerid];
    const timeFrom = Math.ceil(dateMath.parse(this.range.from) / 1000);
    const timeTo = Math.ceil(dateMath.parse(this.range.to) / 1000);
    return getDataSourceSrv().get(problem.datasource)
    .then((datasource: any) => {
      return datasource.zabbix.getEvents(triggerids, timeFrom, timeTo, [0, 1], PROBLEM_EVENTS_LIMIT);
    });
  }

  getProblemAlerts(problem: ProblemDTO) {
    if (!problem.eventid) {
      return Promise.resolve([]);
    }
    const eventids = [problem.eventid];
    return getDataSourceSrv().get(problem.datasource)
    .then((datasource: any) => {
      return datasource.zabbix.getEventAlerts(eventids);
    });
  }

  getProblemScripts(problem: ProblemDTO) {
    const hostid = problem.hosts?.length ? problem.hosts[0].hostid : null;

    return getDataSourceSrv().get(problem.datasource)
    .then((datasource: any) => {
      return datasource.zabbix.getScripts([hostid]);
    });
  }

  getAlertIconClassBySeverity(triggerSeverity) {
    let iconClass = 'icon-gf-online';
    if (triggerSeverity.priority >= 2) {
      iconClass = 'icon-gf-critical';
    }
    return iconClass;
  }

  resetResizedColumns() {
    this.panel.resizedColumns = [];
    this.render();
  }

  acknowledgeProblem(problem: ProblemDTO, message, action, severity) {
    const eventid = problem.eventid;
    const grafana_user = this.contextSrv.user.name;
    const ack_message = grafana_user + ' (Grafana): ' + message;
    return getDataSourceSrv().get(problem.datasource)
    .then((datasource: any) => {
      const userIsEditor = this.contextSrv.isEditor || this.contextSrv.isGrafanaAdmin;
      if (datasource.disableReadOnlyUsersAck && !userIsEditor) {
        return Promise.reject({message: 'You have no permissions to acknowledge events.'});
      }
      if (eventid) {
        return datasource.zabbix.acknowledgeEvent(eventid, ack_message, action, severity);
      } else {
        return Promise.reject({message: 'Trigger has no events. Nothing to acknowledge.'});
      }
    })
    .then(this.refresh.bind(this))
    .catch((err) => {
      this.setPanelError(err);
      return Promise.reject(err);
    });
  }

  executeScript(problem: ProblemDTO, scriptid: string) {
    const hostid = problem.hosts?.length ? problem.hosts[0].hostid : null;

    return getDataSourceSrv().get(problem.datasource)
    .then((datasource: any) => {
      return datasource.zabbix.executeScript(hostid, scriptid);
    });
  }

  handlePageSizeChange(pageSize, pageIndex) {
    this.panel.pageSize = pageSize;
    this.pageIndex = pageIndex;
    this.scope.$apply(() => {
      this.render();
    });
  }

  handleColumnResize(newResized) {
    this.panel.resizedColumns = newResized;
    this.scope.$apply(() => {
      this.render();
    });
  }

  link(scope, elem, attrs, ctrl) {
    const panel = ctrl.panel;

    ctrl.events.on(PanelEvents.render, (renderData) => {
      renderData = renderData || this.renderData;
      renderPanel(renderData);
      ctrl.renderingCompleted();
    });

    function renderPanel(problems) {
      const timeFrom = Math.ceil(dateMath.parse(ctrl.range.from) / 1000);
      const timeTo = Math.ceil(dateMath.parse(ctrl.range.to) / 1000);

      const fontSize = parseInt(panel.fontSize.slice(0, panel.fontSize.length - 1), 10);
      const fontSizeProp = fontSize && fontSize !== 100 ? fontSize : null;

      const pageSize = panel.pageSize || 10;
      const loading = ctrl.loading && (!problems || !problems.length);

      const panelOptions = {};
      for (const prop in PANEL_DEFAULTS) {
        panelOptions[prop] = ctrl.panel[prop];
      }
      const problemsListProps = {
        problems,
        panelOptions,
        timeRange: { timeFrom, timeTo },
        loading,
        pageSize,
        fontSize: fontSizeProp,
        panelId: ctrl.panel.id,
        getProblemEvents: ctrl.getProblemEvents.bind(ctrl),
        getProblemAlerts: ctrl.getProblemAlerts.bind(ctrl),
        getScripts: ctrl.getProblemScripts.bind(ctrl),
        onPageSizeChange: ctrl.handlePageSizeChange.bind(ctrl),
        onColumnResize: ctrl.handleColumnResize.bind(ctrl),
        onProblemAck: (trigger, data) => {
          const { message, action, severity } = data;
          return ctrl.acknowledgeProblem(trigger, message, action, severity);
        },
        onExecuteScript: ctrl.executeScript.bind(ctrl),
        onTagClick: (tag, datasource, ctrlKey, shiftKey) => {
          if (ctrlKey || shiftKey) {
            ctrl.removeTagFilter(tag, datasource);
          } else {
            ctrl.addTagFilter(tag, datasource);
          }
        }
      };

      let problemsReactElem;
      if (panel.layout === 'list') {
        problemsReactElem = React.createElement(AlertList, problemsListProps);
      } else {
        problemsReactElem = React.createElement(ProblemList, problemsListProps);
      }

      const panelContainerElem = elem.find('.panel-content');
      if (panelContainerElem && panelContainerElem.length) {
        ReactDOM.render(problemsReactElem, panelContainerElem[0]);
      } else {
        ReactDOM.render(problemsReactElem, elem[0]);
      }
    }
  }
}

TriggerPanelCtrl.templateUrl = 'public/plugins/alexanderzobnin-zabbix-app/panel-triggers/partials/module.html';
