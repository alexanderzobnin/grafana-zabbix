export interface ZabbixConnector {
  getHistory: (items, timeFrom, timeTill) => Promise<any>;
  getTrend: (items, timeFrom, timeTill) => Promise<any>;
  getItemsByIDs: (itemids) => Promise<any>;
  getEvents: (objectids, timeFrom, timeTo, showEvents, limit?) => Promise<any>;
  getAlerts: (itemids, timeFrom?, timeTo?) => Promise<any>;
  getHostAlerts: (hostids, applicationids, options?) => Promise<any>;
  getAcknowledges: (eventids) => Promise<any>;
  getITService: (serviceids?) => Promise<any>;
  acknowledgeEvent: (eventid, message) => Promise<any>;
  getProxies: () => Promise<any>;
  getEventAlerts: (eventids) => Promise<any>;
  getExtendedEventData: (eventids) => Promise<any>;
  getMacros: (hostids: any[]) => Promise<any>;
  getVersion: () => Promise<string>;

  getGroups: (groupFilter?) => any;
  getHosts: (groupFilter?, hostFilter?) => any;
  getApps: (groupFilter?, hostFilter?, appFilter?) => any;
  getItems: (groupFilter?, hostFilter?, appFilter?, itemFilter?, options?) => any;
  getSLA: (itservices, timeRange, target, options?) => any;

  supportsApplications: () => boolean;
}
