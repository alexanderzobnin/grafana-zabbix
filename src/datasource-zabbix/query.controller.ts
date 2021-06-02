import { QueryCtrl } from 'grafana/app/plugins/sdk';
import _ from 'lodash';
import * as c from './constants';
import * as utils from './utils';
import * as metricFunctions from './metricFunctions';
import * as migrations from './migrations';
import { ShowProblemTypes, ZabbixMetricsQuery } from './types';
import { CURRENT_SCHEMA_VERSION } from '../panel-triggers/migrations';
import { getTemplateSrv, TemplateSrv } from '@grafana/runtime';


function getTargetDefaults() {
  return {
    queryType: c.MODE_METRICS,
    group: { 'filter': "" },
    host: { 'filter': "" },
    application: { 'filter': "" },
    item: { 'filter': "" },
    functions: [],
    triggers: {
      'count': true,
      'minSeverity': 3,
      'acknowledged': 2
    },
    trigger: {filter: ""},
    tags: {filter: ""},
    proxy: {filter: ""},
    options: {
      showDisabledItems: false,
      skipEmptyValues: false,
      disableDataAlignment: false,
      useZabbixValueMapping: false,
    },
    table: {
      'skipEmptyValues': false
    },
  };
}

function getSLATargetDefaults() {
  return {
    slaProperty: { name: "SLA", property: "sla" },
    slaInterval: 'none',
  };
}

function getProblemsTargetDefaults() {
  return {
    showProblems: ShowProblemTypes.Problems,
    options: {
      minSeverity: 0,
      sortProblems: 'default',
      acknowledged: 2,
      hostsInMaintenance: false,
      hostProxy: false,
      limit: c.DEFAULT_ZABBIX_PROBLEMS_LIMIT,
    },
  };
}

function getSeverityOptions() {
  return c.TRIGGER_SEVERITY;
}

function mapSeverityOptionsFromPanel(severityOptions: any[]) {
  if (!severityOptions) {
    return [0, 1, 2, 3, 4, 5];
  }

  const severities = [];
  for (const sevOption of severityOptions) {
    if (sevOption.show) {
      severities.push(sevOption.priority);
    }
  }
  return severities;
}

export class ZabbixQueryController extends QueryCtrl {
  static templateUrl: string;

  zabbix: any;
  replaceTemplateVars: any;
  templateSrv: TemplateSrv;
  editorModes: Array<{ value: string; text: string; queryType: number; }>;
  slaPropertyList: Array<{ name: string; property: string; }>;
  slaIntervals: Array<{ text: string; value: string; }>;
  ackFilters: Array<{ text: string; value: number; }>;
  problemAckFilters: string[];
  sortByFields: Array<{ text: string; value: string; }>;
  showEventsFields: Array<{ text: string; value: number[]; } | { text: string; value: number; }>;
  showProblemsOptions: Array<{ text: string; value: string; }>;
  resultFormats: Array<{ text: string; value: string; }>;
  severityOptions: Array<{ val: number; text: string; }>;
  getGroupNames: (...args: any[]) => any;
  getHostNames: (...args: any[]) => any;
  getApplicationNames: (...args: any[]) => any;
  getItemNames: (...args: any[]) => any;
  getITServices: (...args: any[]) => any;
  getProxyNames: (...args: any[]) => any;
  getVariables: (...args: any[]) => any;
  init: () => void;
  queryOptionsText: string;
  metric: any;
  showQueryOptions: boolean;
  oldTarget: any;

  /** @ngInject */
  constructor($scope, $injector, $rootScope) {
    super($scope, $injector);
    this.zabbix = this.datasource.zabbix;

    // Use custom format for template variables
    this.replaceTemplateVars = this.datasource.replaceTemplateVars;
    this.templateSrv = getTemplateSrv();

    this.editorModes = [
      {value: 'num',       text: 'Metrics',     queryType: c.MODE_METRICS},
      {value: 'text',      text: 'Text',        queryType: c.MODE_TEXT},
      {value: 'itservice', text: 'IT Services', queryType: c.MODE_ITSERVICE},
      {value: 'itemid',    text: 'Item ID',     queryType: c.MODE_ITEMID},
      {value: 'triggers',  text: 'Triggers',    queryType: c.MODE_TRIGGERS},
      {value: 'problems',  text: 'Problems',    queryType: c.MODE_PROBLEMS},
    ];

    this.$scope.editorMode = {
      METRICS: c.MODE_METRICS,
      TEXT: c.MODE_TEXT,
      ITSERVICE: c.MODE_ITSERVICE,
      ITEMID: c.MODE_ITEMID,
      TRIGGERS: c.MODE_TRIGGERS,
      PROBLEMS: c.MODE_PROBLEMS,
    };

    this.slaPropertyList = [
      {name: "Status", property: "status"},
      {name: "SLA", property: "sla"},
      {name: "OK time", property: "okTime"},
      {name: "Problem time", property: "problemTime"},
      {name: "Down time", property: "downtimeTime"}
    ];

    this.slaIntervals = [
      { text: 'No interval', value: 'none' },
      { text: 'Auto', value: 'auto' },
      { text: '1 hour', value: '1h' },
      { text: '12 hours', value: '12h' },
      { text: '24 hours', value: '1d' },
      { text: '1 week', value: '1w' },
      { text: '1 month', value: '1M' },
    ];

    this.ackFilters = [
      {text: 'all triggers', value: 2},
      {text: 'unacknowledged', value: 0},
      {text: 'acknowledged', value: 1},
    ];

    this.problemAckFilters = [
      'all triggers',
      'unacknowledged',
      'acknowledged'
    ];

    this.sortByFields = [
      { text: 'Default', value: 'default' },
      { text: 'Last change', value: 'lastchange' },
      { text: 'Severity',    value: 'severity' },
    ];

    this.showEventsFields = [
      { text: 'All',      value: [0,1] },
      { text: 'OK',       value: [0] },
      { text: 'Problems', value: 1 }
    ];

    this.showProblemsOptions = [
      { text: 'Problems', value: 'problems' },
      { text: 'Recent problems', value: 'recent' },
      { text: 'History', value: 'history' },
    ];

    this.resultFormats = [{ text: 'Time series', value: 'time_series' }, { text: 'Table', value: 'table' }];

    this.severityOptions = getSeverityOptions();

    // Map functions for bs-typeahead
    this.getGroupNames = _.bind(this.getMetricNames, this, 'groupList');
    this.getHostNames = _.bind(this.getMetricNames, this, 'hostList', true);
    this.getApplicationNames = _.bind(this.getMetricNames, this, 'appList');
    this.getItemNames = _.bind(this.getMetricNames, this, 'itemList');
    this.getITServices = _.bind(this.getMetricNames, this, 'itServiceList');
    this.getProxyNames = _.bind(this.getMetricNames, this, 'proxyList');
    this.getVariables = _.bind(this.getTemplateVariables, this);

    // Update metric suggestion when template variable was changed
    $rootScope.$on('template-variable-value-updated', () => this.onVariableChange());

    // Update metrics when item selected from dropdown
    $scope.$on('typeahead-updated', () => {
      this.onTargetBlur();
    });

    this.init = function() {
      let target = this.target;

      // Migrate old targets
      target = migrations.migrate(target);

      const scopeDefaults = {
        metric: {},
        oldTarget: _.cloneDeep(this.target),
        queryOptionsText: this.renderQueryOptionsText()
      };
      _.defaults(this, scopeDefaults);

      // Load default values
      const targetDefaults = getTargetDefaults();
      _.defaultsDeep(target, targetDefaults);

      if (this.panel.type === c.ZABBIX_PROBLEMS_PANEL_ID) {
        target.queryType = c.MODE_PROBLEMS;
        target.options.severities = mapSeverityOptionsFromPanel(this.panel.triggerSeverity);
      }

      // Create function instances from saved JSON
      target.functions = _.map(target.functions, func => {
        return metricFunctions.createFuncInstance(func.def, func.params);
      });

      if (target.queryType === c.MODE_ITSERVICE) {
        _.defaultsDeep(target, getSLATargetDefaults());
      }

      if (target.queryType === c.MODE_PROBLEMS) {
        _.defaultsDeep(target, getProblemsTargetDefaults());
      }

      if (target.queryType === c.MODE_METRICS ||
          target.queryType === c.MODE_TEXT ||
          target.queryType === c.MODE_TRIGGERS ||
          target.queryType === c.MODE_PROBLEMS) {
        this.initFilters();
      } else if (target.queryType === c.MODE_ITSERVICE) {
        this.suggestITServices();
      }
    };

    // Update panel schema version to prevent unnecessary migrations
    if (this.panel.type === c.ZABBIX_PROBLEMS_PANEL_ID) {
      this.panel.schemaVersion = CURRENT_SCHEMA_VERSION;
    }

    this.init();
    this.queryOptionsText = this.renderQueryOptionsText();
  }

  initFilters() {
    const mode = _.find(this.editorModes, {'queryType': this.target.queryType});
    const itemtype = mode ? mode.value : null;
    const promises = [
      this.suggestGroups(),
      this.suggestHosts(),
      this.suggestApps(),
    ];

    if (this.target.queryType === c.MODE_METRICS || this.target.queryType === c.MODE_TEXT) {
      promises.push(this.suggestItems(itemtype));
    }

    if (this.target.queryType === c.MODE_PROBLEMS) {
      promises.push(this.suggestProxies());
    }

    return Promise.all(promises);
  }

  // Get list of metric names for bs-typeahead directive
  getMetricNames(metricList, addAllValue) {
    const metrics = _.uniq(_.map(this.metric[metricList], 'name'));

    // Add template variables
    _.forEach(this.templateSrv.getVariables(), variable => {
      metrics.unshift('$' + variable.name);
    });

    if (addAllValue) {
      metrics.unshift('/.*/');
    }

    return metrics;
  }

  getTemplateVariables() {
    return _.map(this.templateSrv.getVariables(), variable => {
      return '$' + variable.name;
    });
  }

  suggestGroups() {
    return this.zabbix.getAllGroups()
    .then(groups => {
      this.metric.groupList = groups;
      return groups;
    });
  }

  suggestHosts() {
    const groupFilter = this.replaceTemplateVars(this.target.group.filter);
    return this.zabbix.getAllHosts(groupFilter)
    .then(hosts => {
      this.metric.hostList = hosts;
      return hosts;
    });
  }

  suggestApps() {
    const groupFilter = this.replaceTemplateVars(this.target.group.filter);
    const hostFilter = this.replaceTemplateVars(this.target.host.filter);
    return this.zabbix.getAllApps(groupFilter, hostFilter)
    .then(apps => {
      this.metric.appList = apps;
      return apps;
    });
  }

  suggestItems(itemtype = 'num') {
    const groupFilter = this.replaceTemplateVars(this.target.group.filter);
    const hostFilter = this.replaceTemplateVars(this.target.host.filter);
    const appFilter = this.replaceTemplateVars(this.target.application.filter);
    const options = {
      itemtype: itemtype,
      showDisabledItems: this.target.options.showDisabledItems
    };

    return this.zabbix
    .getAllItems(groupFilter, hostFilter, appFilter, options)
    .then(items => {
      this.metric.itemList = items;
      return items;
    });
  }

  suggestITServices() {
    return this.zabbix.getITService()
    .then(itservices => {
      this.metric.itServiceList = itservices;
      return itservices;
    });
  }

  suggestProxies() {
    return this.zabbix.getProxies()
    .then(response => {
      const proxies = _.map(response, 'host');
      this.metric.proxyList = proxies;
      return proxies;
    });
  }

  isRegex(str) {
    return utils.isRegex(str);
  }

  isVariable(str) {
    return utils.isTemplateVariable(str, this.templateSrv.getVariables());
  }

  onTargetBlur() {
    const newTarget = _.cloneDeep(this.target);
    if (!_.isEqual(this.oldTarget, this.target)) {
      this.oldTarget = newTarget;
      this.targetChanged();
    }
  }

  onVariableChange() {
    if (this.isContainsVariables()) {
      this.targetChanged();
    }
  }

  /**
   * Check query for template variables
   */
  isContainsVariables() {
    return _.some(['group', 'host', 'application'], field => {
      if (this.target[field] && this.target[field].filter) {
        return utils.isTemplateVariable(this.target[field].filter, this.templateSrv.getVariables());
      } else {
        return false;
      }
    });
  }

  parseTarget() {
    // Parse target
  }

  // Validate target and set validation info
  validateTarget() {
    // validate
  }

  targetChanged() {
    this.initFilters();
    this.parseTarget();
    this.refresh();
  }

  addFunction(funcDef) {
    const newFunc = metricFunctions.createFuncInstance(funcDef);
    newFunc.added = true;
    this.target.functions.push(newFunc);

    this.moveAliasFuncLast();

    if (newFunc.params.length && newFunc.added ||
        newFunc.def.params.length === 0) {
      this.targetChanged();
    }
  }

  removeFunction(func) {
    this.target.functions = _.without(this.target.functions, func);
    this.targetChanged();
  }

  moveFunction(func, offset) {
    const index = this.target.functions.indexOf(func);
    // @ts-ignore
    _.move(this.target.functions, index, index + offset);
    this.targetChanged();
  }

  moveAliasFuncLast() {
    const aliasFunc = _.find(this.target.functions, func => {
      return func.def.category === 'Alias';
    });

    if (aliasFunc) {
      this.target.functions = _.without(this.target.functions, aliasFunc);
      this.target.functions.push(aliasFunc);
    }
  }

  toggleQueryOptions() {
    this.showQueryOptions = !this.showQueryOptions;
  }

  onQueryOptionChange() {
    this.queryOptionsText = this.renderQueryOptionsText();
    this.onTargetBlur();
  }

  renderQueryOptionsText() {
    const metricOptionsMap = {
      showDisabledItems: "Show disabled items",
      disableDataAlignment: "Disable data alignment",
      useZabbixValueMapping: "Use Zabbix value mapping",
    };

    const problemsOptionsMap = {
      sortProblems: "Sort problems",
      acknowledged: "Acknowledged",
      skipEmptyValues: "Skip empty values",
      hostsInMaintenance: "Show hosts in maintenance",
      limit: "Limit problems",
      hostProxy: "Show proxy",
      useTimeRange: "Use time range",
    };

    let optionsMap = {};

    if (this.target.queryType === c.MODE_METRICS) {
      optionsMap = metricOptionsMap;
    } else if (this.target.queryType === c.MODE_PROBLEMS || this.target.queryType === c.MODE_TRIGGERS) {
      optionsMap = problemsOptionsMap;
    }

    const options = [];
    _.forOwn(this.target.options, (value, key) => {
      if (value && optionsMap[key]) {
        if (value === true) {
          // Show only option name (if enabled) for boolean options
          options.push(optionsMap[key]);
        } else {
          // Show "option = value" for another options
          let optionValue = value;
          if (value && value.text) {
            optionValue = value.text;
          } else if (value && value.value) {
            optionValue = value.value;
          }
          options.push(optionsMap[key] + " = " + optionValue);
        }
      }
    });
    return "Options: " + options.join(', ');
  }

  /**
   * Switch query editor to specified mode.
   * Modes:
   *  0 - items
   *  1 - IT services
   *  2 - Text metrics
   */
  switchEditorMode(mode) {
    this.target.queryType = mode;
    this.queryOptionsText = this.renderQueryOptionsText();
    this.init();
    this.targetChanged();
  }

  appFilterDisabled() {
    return !this.zabbix.supportsApplications();
  }
}
