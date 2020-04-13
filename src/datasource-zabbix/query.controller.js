import { QueryCtrl } from 'grafana/app/plugins/sdk';
import _ from 'lodash';
import * as c from './constants';
import * as utils from './utils';
import * as metricFunctions from './metricFunctions';
import * as migrations from './migrations';

export class ZabbixQueryController extends QueryCtrl {

  /** @ngInject */
  constructor($scope, $injector, $rootScope, $sce, templateSrv) {
    super($scope, $injector);
    this.zabbix = this.datasource.zabbix;

    // Use custom format for template variables
    this.replaceTemplateVars = this.datasource.replaceTemplateVars;
    this.templateSrv = templateSrv;

    this.editorModes = [
      {value: 'num',       text: 'Metrics',     mode: c.MODE_METRICS},
      {value: 'text',      text: 'Text',        mode: c.MODE_TEXT},
      {value: 'itservice', text: 'IT Services', mode: c.MODE_ITSERVICE},
      {value: 'itemid',    text: 'Item ID',     mode: c.MODE_ITEMID},
      {value: 'triggers',  text: 'Triggers',    mode: c.MODE_TRIGGERS},
      {value: 'map',       text: 'Map',         mode: c.MODE_MAP}
    ];

    this.$scope.editorMode = {
      METRICS: c.MODE_METRICS,
      TEXT: c.MODE_TEXT,
      ITSERVICE: c.MODE_ITSERVICE,
      MAP: c.MODE_MAP,
      ITEMID: c.MODE_ITEMID,
      TRIGGERS: c.MODE_TRIGGERS
    };

    this.slaPropertyList = [
      {name: "Status", property: "status"},
      {name: "SLA", property: "sla"},
      {name: "OK time", property: "okTime"},
      {name: "Problem time", property: "problemTime"},
      {name: "Down time", property: "downtimeTime"}
    ];

    this.mapQueryTypeList = [
      {name: "Properties", queryType: "properties"},
      {name: "Elements", queryType: "elements"},
      {name: "Links", queryType: "links"}
    ];

    this.ackFilters = [
      {text: 'all triggers', value: 2},
      {text: 'unacknowledged', value: 0},
      {text: 'acknowledged', value: 1},
    ];

    this.resultFormats = [{ text: 'Time series', value: 'time_series' }, { text: 'Table', value: 'table' }];

    this.triggerSeverity = c.TRIGGER_SEVERITY;

    // Map functions for bs-typeahead
    this.getGroupNames = _.bind(this.getMetricNames, this, 'groupList');
    this.getHostNames = _.bind(this.getMetricNames, this, 'hostList', true);
    this.getApplicationNames = _.bind(this.getMetricNames, this, 'appList');
    this.getItemNames = _.bind(this.getMetricNames, this, 'itemList');
    this.getITServices = _.bind(this.getMetricNames, this, 'itServiceList');
    this.getMaps = _.bind(this.getMetricNames, this, 'mapList');
    this.getVariables = _.bind(this.getTemplateVariables, this);

    // Update metric suggestion when template variable was changed
    $rootScope.$on('template-variable-value-updated', () => this.onVariableChange());

    // Update metrics when item selected from dropdown
    $scope.$on('typeahead-updated', () => {
      this.onTargetBlur();
    });

    this.init = function() {
      var target = this.target;

      // Migrate old targets
      target = migrations.migrate(target);

      var scopeDefaults = {
        metric: {},
        oldTarget: _.cloneDeep(this.target),
        queryOptionsText: this.renderQueryOptionsText()
      };
      _.defaults(this, scopeDefaults);

      // Load default values
      var targetDefaults = {
        'mode': c.MODE_METRICS,
        'group': { 'filter': "" },
        'host': { 'filter': "" },
        'application': { 'filter': "" },
        'item': { 'filter': "" },
        'functions': [],
        'triggers': {
          'count': true,
          'minSeverity': 3,
          'acknowledged': 2
        },
        'options': {
          'showDisabledItems': false,
          'skipEmptyValues': false
        },
        'table': {
          'skipEmptyValues': false
        }
      };
      _.defaults(target, targetDefaults);

      // Create function instances from saved JSON
      target.functions = _.map(target.functions, function(func) {
        return metricFunctions.createFuncInstance(func.def, func.params);
      });

      if (target.mode === c.MODE_METRICS ||
          target.mode === c.MODE_TEXT ||
          target.mode === c.MODE_TRIGGERS) {
        this.initFilters();
      }
      else if (target.mode === c.MODE_ITSERVICE) {
        _.defaults(target, {slaProperty: {name: "SLA", property: "sla"}});
        this.suggestITServices();
      }
      else if (target.mode === c.MODE_MAP) {
        console.debug('maps mode. Will call suggestmaps()');
        _.defaults(target, {mapQueryType: {name: "Properties", queryType: "properties"}});
        this.suggestMaps();
      }
    };

    this.init();
    this.queryOptionsText = this.renderQueryOptionsText();
  }

  initFilters() {
    let itemtype = _.find(this.editorModes, {'mode': this.target.mode});
    itemtype = itemtype ? itemtype.value : null;
    return Promise.all([
      this.suggestGroups(),
      this.suggestHosts(),
      this.suggestApps(),
      this.suggestItems(itemtype)
    ]);
  }

  // Get list of metric names for bs-typeahead directive
  getMetricNames(metricList, addAllValue) {
    let metrics = _.uniq(_.map(this.metric[metricList], 'name'));

    // Add template variables
    _.forEach(this.templateSrv.variables, variable => {
      metrics.unshift('$' + variable.name);
    });

    if (addAllValue) {
      metrics.unshift('/.*/');
    }

    return metrics;
  }

  getTemplateVariables() {
    return _.map(this.templateSrv.variables, variable => {
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
    let groupFilter = this.replaceTemplateVars(this.target.group.filter);
    return this.zabbix.getAllHosts(groupFilter)
    .then(hosts => {
      this.metric.hostList = hosts;
      return hosts;
    });
  }

  suggestApps() {
    let groupFilter = this.replaceTemplateVars(this.target.group.filter);
    let hostFilter = this.replaceTemplateVars(this.target.host.filter);
    return this.zabbix.getAllApps(groupFilter, hostFilter)
    .then(apps => {
      this.metric.appList = apps;
      return apps;
    });
  }

  suggestItems(itemtype = 'num') {
    let groupFilter = this.replaceTemplateVars(this.target.group.filter);
    let hostFilter = this.replaceTemplateVars(this.target.host.filter);
    let appFilter = this.replaceTemplateVars(this.target.application.filter);
    let options = {
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

  suggestMaps() {
    console.debug('calling this.zabbix.getMap()');
    return this.zabbix.getMap()
    .then(maps => {
      console.debug('Suggested maps: ', maps);
      this.metric.mapList = maps;
      return maps;
    });
  }

  isRegex(str) {
    return utils.isRegex(str);
  }

  isVariable(str) {
    return utils.isTemplateVariable(str, this.templateSrv.variables);
  }

  onTargetBlur() {
    var newTarget = _.cloneDeep(this.target);
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
        return utils.isTemplateVariable(this.target[field].filter, this.templateSrv.variables);
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
    this.panelCtrl.refresh();
  }

  addFunction(funcDef) {
    var newFunc = metricFunctions.createFuncInstance(funcDef);
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
    _.move(this.target.functions, index, index + offset);
    this.targetChanged();
  }

  moveAliasFuncLast() {
    var aliasFunc = _.find(this.target.functions, func => {
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
    var optionsMap = {
      showDisabledItems: "Show disabled items",
      skipEmptyValues: "Skip empty values"
    };
    var options = [];
    _.forOwn(this.target.options, (value, key) => {
      if (value) {
        if (value === true) {
          // Show only option name (if enabled) for boolean options
          options.push(optionsMap[key]);
        } else {
          // Show "option = value" for another options
          options.push(optionsMap[key] + " = " + value);
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
    this.target.mode = mode;
    this.init();
    this.targetChanged();
  }
}
