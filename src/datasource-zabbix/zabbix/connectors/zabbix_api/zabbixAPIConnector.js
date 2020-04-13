import _ from 'lodash';
import kbn from 'grafana/app/core/utils/kbn';
import * as utils from '../../../utils';
import { ZabbixAPICore } from './zabbixAPICore';
import { ZBX_ACK_ACTION_NONE, ZBX_ACK_ACTION_ACK, ZBX_ACK_ACTION_ADD_MESSAGE, MIN_SLA_INTERVAL } from '../../../constants';

/**
 * Zabbix API Wrapper.
 * Creates Zabbix API instance with given parameters (url, credentials and other).
 * Wraps API calls and provides high-level methods.
 */
export class ZabbixAPIConnector {
  constructor(api_url, username, password, version, basicAuth, withCredentials) {
    this.url              = api_url;
    this.username         = username;
    this.password         = password;
    this.auth             = '';
    this.version          = version;

    this.requestOptions = {
      basicAuth: basicAuth,
      withCredentials: withCredentials
    };

    this.loginPromise = null;
    this.loginErrorCount = 0;
    this.maxLoginAttempts = 3;

    this.zabbixAPICore = new ZabbixAPICore();

    this.getTrend = this.getTrend_ZBXNEXT1193;
    //getTrend = getTrend_30;
  }

  //////////////////////////
  // Core method wrappers //
  //////////////////////////

  request(method, params) {
    return this.zabbixAPICore.request(this.url, method, params, this.requestOptions, this.auth)
    .catch(error => {
      if (isNotAuthorized(error.data)) {
        // Handle auth errors
        this.loginErrorCount++;
        if (this.loginErrorCount > this.maxLoginAttempts) {
          this.loginErrorCount = 0;
          return null;
        } else {
          return this.loginOnce()
          .then(() => this.request(method, params));
        }
      } else {
        return Promise.reject(error);
      }
    });
  }

  /**
   * When API unauthenticated or auth token expired each request produce login()
   * call. But auth token is common to all requests. This function wraps login() method
   * and call it once. If login() already called just wait for it (return its promise).
   * @return login promise
   */
  loginOnce() {
    if (!this.loginPromise) {
      this.loginPromise = Promise.resolve(
        this.login().then(auth => {
          this.auth = auth;
          this.loginPromise = null;
          return auth;
        })
      );
    }
    return this.loginPromise;
  }

  /**
   * Get authentication token.
   */
  login() {
    return this.zabbixAPICore.login(this.url, this.username, this.password, this.requestOptions);
  }

  /**
   * Get Zabbix API version
   */
  getVersion() {
    return this.zabbixAPICore.getVersion(this.url, this.requestOptions);
  }

  ////////////////////////////////
  // Zabbix API method wrappers //
  ////////////////////////////////

  acknowledgeEvent(eventid, message) {
    const action = this.version >= 4 ? ZBX_ACK_ACTION_ACK + ZBX_ACK_ACTION_ADD_MESSAGE : ZBX_ACK_ACTION_NONE;
    const params = {
      eventids: eventid,
      message: message,
      action: action
    };

    return this.request('event.acknowledge', params);
  }

  getGroups() {
    var params = {
      output: ['name'],
      sortfield: 'name',
      real_hosts: true
    };

    return this.request('hostgroup.get', params);
  }

  getHosts(groupids) {
    var params = {
      output: ['name', 'host'],
      sortfield: 'name'
    };
    if (groupids) {
      params.groupids = groupids;
    }

    return this.request('host.get', params);
  }

  getApps(hostids) {
    var params = {
      output: 'extend',
      hostids: hostids
    };

    return this.request('application.get', params);
  }

  /**
   * Get Zabbix items
   * @param  {[type]} hostids  host ids
   * @param  {[type]} appids   application ids
   * @param  {String} itemtype 'num' or 'text'
   * @return {[type]}          array of items
   */
  getItems(hostids, appids, itemtype) {
    var params = {
      output: [
        'name', 'key_',
        'value_type',
        'hostid',
        'status',
        'state'
      ],
      sortfield: 'name',
      webitems: true,
      filter: {},
      selectHosts: ['hostid', 'name']
    };
    if (hostids) {
      params.hostids = hostids;
    }
    if (appids) {
      params.applicationids = appids;
    }
    if (itemtype === 'num') {
      // Return only numeric metrics
      params.filter.value_type = [0, 3];
    }
    if (itemtype === 'text') {
      // Return only text metrics
      params.filter.value_type = [1, 2, 4];
    }

    return this.request('item.get', params)
    .then(utils.expandItems);
  }

  getItemsByIDs(itemids) {
    var params = {
      itemids: itemids,
      output: [
        'name', 'key_',
        'value_type',
        'hostid',
        'status',
        'state'
      ],
      webitems: true,
      selectHosts: ['hostid', 'name']
    };

    return this.request('item.get', params)
    .then(utils.expandItems);
  }

  getMacros(hostids) {
    var params = {
      output: 'extend',
      hostids: hostids
    };

    return this.request('usermacro.get', params);
  }

  getGlobalMacros() {
    var params = {
      output: 'extend',
      globalmacro: true
    };

    return this.request('usermacro.get', params);
  }

  getLastValue(itemid) {
    var params = {
      output: ['lastvalue'],
      itemids: itemid
    };
    return this.request('item.get', params)
    .then(items => items.length ? items[0].lastvalue : null);
  }

  /**
   * Perform history query from Zabbix API
   *
   * @param  {Array}  items       Array of Zabbix item objects
   * @param  {Number} timeFrom   Time in seconds
   * @param  {Number} timeTill   Time in seconds
   * @return {Array}  Array of Zabbix history objects
   */
  getHistory(items, timeFrom, timeTill) {

    // Group items by value type and perform request for each value type
    let grouped_items = _.groupBy(items, 'value_type');
    let promises = _.map(grouped_items, (items, value_type) => {
      let itemids = _.map(items, 'itemid');
      let params = {
        output: 'extend',
        history: value_type,
        itemids: itemids,
        sortfield: 'clock',
        sortorder: 'ASC',
        time_from: timeFrom
      };

      // Relative queries (e.g. last hour) don't include an end time
      if (timeTill) {
        params.time_till = timeTill;
      }

      return this.request('history.get', params);
    });

    return Promise.all(promises).then(_.flatten);
  }

  /**
   * Perform trends query from Zabbix API
   * Use trends api extension from ZBXNEXT-1193 patch.
   *
   * @param  {Array}  items       Array of Zabbix item objects
   * @param  {Number} time_from   Time in seconds
   * @param  {Number} time_till   Time in seconds
   * @return {Array}  Array of Zabbix trend objects
   */
  getTrend_ZBXNEXT1193(items, timeFrom, timeTill) {

    // Group items by value type and perform request for each value type
    let grouped_items = _.groupBy(items, 'value_type');
    let promises = _.map(grouped_items, (items, value_type) => {
      let itemids = _.map(items, 'itemid');
      let params = {
        output: 'extend',
        trend: value_type,
        itemids: itemids,
        sortfield: 'clock',
        sortorder: 'ASC',
        time_from: timeFrom
      };

      // Relative queries (e.g. last hour) don't include an end time
      if (timeTill) {
        params.time_till = timeTill;
      }

      return this.request('trend.get', params);
    });

    return Promise.all(promises).then(_.flatten);
  }

  getTrend_30(items, time_from, time_till, value_type) {
    var self = this;
    var itemids = _.map(items, 'itemid');

    var params = {
      output: ["itemid",
        "clock",
        value_type
      ],
      itemids: itemids,
      time_from: time_from
    };

    // Relative queries (e.g. last hour) don't include an end time
    if (time_till) {
      params.time_till = time_till;
    }

    return self.request('trend.get', params);
  }

  getITService(serviceids) {
    var params = {
      output: 'extend',
      serviceids: serviceids
    };
    return this.request('service.get', params);
  }

  getMap(mapids) {
    var params = {
      //   output: 'extend',
      //   selectSelements: 'extend',
      //   selectLinks: 'extend',
      output: ['sysmapid', 'name', 'width', 'height', 'backgroundid'],
      selectSelements: ['selementid', 'sysmapid', 'elementtype', 'label', 'x', 'y'],
      selectLinks: 'extend',
      sysmapids: mapids
    };
    // if (queryType == 'properties') {params.output = 'extend'};
    // if (queryType == 'elements') {params.selectSelements = 'extend'};
    // if (queryType == 'links') {params.selectLinks = 'extend'};
    console.debug('API Query params: ' + JSON.stringify(params));
    return this.request('map.get', params);
  }

  getSLA(serviceids, timeRange, options) {
    const intervals = buildSLAIntervals(timeRange, options.intervalMs);
    const params = {
      serviceids,
      intervals
    };
    return this.request('service.getsla', params);
  }

  getTriggers(groupids, hostids, applicationids, options) {
    let {showTriggers, maintenance, timeFrom, timeTo} = options;

    let params = {
      output: 'extend',
      groupids: groupids,
      hostids: hostids,
      applicationids: applicationids,
      expandDescription: true,
      expandData: true,
      expandComment: true,
      monitored: true,
      skipDependent: true,
      //only_true: true,
      filter: {
        value: 1
      },
      selectGroups: ['name'],
      selectHosts: ['name', 'host', 'maintenance_status', 'proxy_hostid'],
      selectItems: ['name', 'key_', 'lastvalue'],
      selectLastEvent: 'extend',
      selectTags: 'extend'
    };

    if (showTriggers) {
      params.filter.value = showTriggers;
    }

    if (maintenance) {
      params.maintenance = true;
    }

    if (timeFrom || timeTo) {
      params.lastChangeSince = timeFrom;
      params.lastChangeTill = timeTo;
    }

    return this.request('trigger.get', params);
  }

  getEvents(objectids, timeFrom, timeTo, showEvents, limit) {
    var params = {
      output: 'extend',
      time_from: timeFrom,
      time_till: timeTo,
      objectids: objectids,
      select_acknowledges: 'extend',
      selectHosts: 'extend',
      value: showEvents,
    };

    if (limit) {
      params.limit = limit;
      params.sortfield = 'clock';
      params.sortorder = 'DESC';
    }

    return this.request('event.get', params);
  }

  getAcknowledges(eventids) {
    var params = {
      output: 'extend',
      eventids: eventids,
      preservekeys: true,
      select_acknowledges: 'extend',
      sortfield: 'clock',
      sortorder: 'DESC'
    };

    return this.request('event.get', params)
    .then(events => {
      return _.filter(events, (event) => event.acknowledges.length);
    });
  }

  getExtendedEventData(eventids) {
    var params = {
      output: 'extend',
      eventids: eventids,
      preservekeys: true,
      select_acknowledges: 'extend',
      selectTags: 'extend',
      sortfield: 'clock',
      sortorder: 'DESC'
    };

    return this.request('event.get', params);
  }

  getEventAlerts(eventids) {
    const params = {
      eventids: eventids,
      output: [
        'eventid',
        'message',
        'clock',
        'error'
      ],
      selectUsers: true,
    };

    return this.request('alert.get', params);
  }

  getAlerts(itemids, timeFrom, timeTo) {
    var params = {
      output: 'extend',
      itemids: itemids,
      expandDescription: true,
      expandData: true,
      expandComment: true,
      monitored: true,
      skipDependent: true,
      //only_true: true,
      // filter: {
      //   value: 1
      // },
      selectLastEvent: 'extend'
    };

    if (timeFrom || timeTo) {
      params.lastChangeSince = timeFrom;
      params.lastChangeTill = timeTo;
    }

    return this.request('trigger.get', params);
  }

  getHostAlerts(hostids, applicationids, options) {
    let {minSeverity, acknowledged, count, timeFrom, timeTo} = options;
    let params = {
      output: 'extend',
      hostids: hostids,
      min_severity: minSeverity,
      filter: { value: 1 },
      expandDescription: true,
      expandData: true,
      expandComment: true,
      monitored: true,
      skipDependent: true,
      selectLastEvent: 'extend',
      selectGroups: 'extend',
      selectHosts: ['host', 'name']
    };

    if (count && acknowledged !== 0 && acknowledged !== 1) {
      params.countOutput = true;
    }

    if (applicationids && applicationids.length) {
      params.applicationids = applicationids;
    }

    if (timeFrom || timeTo) {
      params.lastChangeSince = timeFrom;
      params.lastChangeTill = timeTo;
    }

    return this.request('trigger.get', params)
    .then((triggers) => {
      if (!count || acknowledged === 0 || acknowledged === 1) {
        triggers = filterTriggersByAcknowledge(triggers, acknowledged);
        if (count) {
          triggers = triggers.length;
        }
      }
      return triggers;
    });
  }

  getProxies() {
    var params = {
      output: ['proxyid', 'host'],
    };

    return this.request('proxy.get', params);
  }
}

function filterTriggersByAcknowledge(triggers, acknowledged) {
  if (acknowledged === 0) {
    return _.filter(triggers, (trigger) => trigger.lastEvent.acknowledged === "0");
  } else if (acknowledged === 1) {
    return _.filter(triggers, (trigger) => trigger.lastEvent.acknowledged === "1");
  } else {
    return triggers;
  }
}

function isNotAuthorized(message) {
  return (
    message === "Session terminated, re-login, please." ||
    message === "Not authorised." ||
    message === "Not authorized."
  );
}

function getSLAInterval(intervalMs) {
  // Too many intervals may cause significant load on the database, so decrease number of resulting points
  const resolutionRatio = 100;
  const interval = kbn.round_interval(intervalMs * resolutionRatio) / 1000;
  return Math.max(interval, MIN_SLA_INTERVAL);
}

function buildSLAIntervals(timeRange, intervalMs) {
  let [timeFrom, timeTo] = timeRange;
  const slaInterval = getSLAInterval(intervalMs);
  const intervals = [];

  // Align time range with calculated interval
  timeFrom = Math.floor(timeFrom / slaInterval) * slaInterval;
  timeTo = Math.ceil(timeTo / slaInterval) * slaInterval;

  for (let i = timeFrom; i <= timeTo - slaInterval; i += slaInterval) {
    intervals.push({
      from : i,
      to : (i + slaInterval)
    });

  }

  return intervals;
}
