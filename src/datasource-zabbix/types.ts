import { SelectableValue, DataQuery, DataSourceJsonData } from "@grafana/data";

export interface ZabbixDSOptions extends DataSourceJsonData {
  username: string;
  password?: string;
  trends: boolean;
  trendsFrom: string;
  trendsRange: string;
  cacheTTL: string;
  timeout?: string;
  dbConnectionEnable: boolean;
  dbConnectionDatasourceId?: number;
  dbConnectionDatasourceName?: string;
  dbConnectionRetentionPolicy?: string;
  disableReadOnlyUsersAck: boolean;
  disableDataAlignment: boolean;
}

export interface ZabbixSecureJSONData {
  password?: string;
}

export interface ZabbixConnectionInfo {
  zabbixVersion: string;
  dbConnectorStatus: {
    dsType: string;
    dsName: string;
  };
}

export interface ZabbixConnectionTestQuery {
  datasourceId: number;
  queryType: string;
}

export interface ZabbixMetricsQuery extends DataQuery {
  triggers: { minSeverity: string; acknowledged: boolean; count: number; };
  queryType: string;
  datasourceId: number;
  group: { filter: string; name?: string; };
  host: { filter: string; name?: string; };
  application: { filter: string; name?: string; };
  item: { filter: string; name?: string; };
  textFilter: string;
  mode: number;
  itemids: number[];
  useCaptureGroups: boolean;
  proxy?: { filter: string; };
  trigger?: { filter: string; };
  itServiceFilter?: string;
  tags?: { filter: string; };
  functions: ZabbixMetricFunction[];
  options: ZabbixQueryOptions;
  // Problems
  showProblems?: ShowProblemTypes;
  // Deprecated
  hostFilter?: string;
  itemFilter?: string;
}

export interface ZabbixQueryOptions {
  showDisabledItems?: boolean;
  skipEmptyValues?: boolean;
  disableDataAlignment?: boolean;
  useZabbixValueMapping?: boolean;
  // Problems options
  minSeverity?: number;
  sortProblems?: string;
  acknowledged?: number;
  hostsInMaintenance?: boolean;
  hostProxy?: boolean;
  limit?: number;
  useTimeRange?: boolean;
  severities?: number[];
}

export interface ZabbixMetricFunction {
  name: string;
  params: any;
  def: { name: string; params: any; };
}

// The paths of these files have moved around in Grafana and they don't resolve properly
// either. Safer not to bother trying to import them just for type hinting.

export interface TemplateSrv {
  variables: {
    name: string;
  };
  highlightVariablesAsHtml(str: any): any;
  replace(target: any, scopedVars?: any, format?: any): any;
}

export interface DashboardSrv {
  dash: any;
}

// Grafana types from backend code

type RowValues = object[];
type TimePoint = [number?, number?];
type TimeSeriesPoints = TimePoint[];
type TimeSeriesSlice = TimeSeries[];

interface TimeSeries {
  name: string;
  points: TimeSeriesPoints;
  tags: { [key: string]: string };
}

interface TableColumn {
  text: string;
}

interface Table {
  columns: TableColumn[];
  rows: RowValues[];
}

interface QueryResult {
  error: string;
  refId: string;
  meta: any;
  series: TimeSeriesSlice[];
  tables: Table[];
}

export interface TSDBResponse {
  results: { [key: string]: QueryResult };
  message: string;
}

export interface VariableQueryProps {
  query: LegacyVariableQuery;
  onChange: (query: VariableQuery, definition: string) => void;
  datasource: any;
  templateSrv: any;
}

export interface VariableQueryData extends VariableQuery {
  selectedQueryType: SelectableValue<VariableQueryTypes>;
  legacyQuery?: string;
}

export interface VariableQuery {
  queryType: VariableQueryTypes;
  group?: string;
  host?: string;
  application?: string;
  item?: string;
}

export type LegacyVariableQuery = VariableQuery | string;

export enum VariableQueryTypes {
  Group = 'group',
  Host = 'host',
  Application = 'application',
  Item = 'item',
  ItemValues = 'itemValues',
}

export enum ShowProblemTypes {
  Problems = 'problems',
  Recent = 'recent',
  History = 'history',
}

export interface ProblemDTO {
  triggerid?: string;
  eventid?: string;
  timestamp: number;

  /** Name of the trigger. */
  name?: string;

  /** Same as a name. */
  description?: string;

  /** Whether the trigger is in OK or problem state. */
  value?: string;

  datasource?: string;
  comments?: string;
  host?: string;
  hostTechName?: string;
  proxy?: string;
  severity?: string;

  acknowledged?: '1' | '0';
  acknowledges?: ZBXAcknowledge[];

  groups?: ZBXGroup[];
  hosts?: ZBXHost[];
  items?: ZBXItem[];
  alerts?: ZBXAlert[];
  tags?: ZBXTag[];
  url?: string;

  expression?: string;
  correlation_mode?: string;
  correlation_tag?: string;
  suppressed?: string;
  suppression_data?: any[];
  state?: string;
  maintenance?: boolean;
  manual_close?: string;
  error?: string;

  showAckButton?: boolean;
}

export interface ZBXProblem {
  acknowledged?: '1' | '0';
  acknowledges?: ZBXAcknowledge[];
  clock: string;
  ns: string;
  correlationid?: string;
  datasource?: string;
  name?: string;
  eventid?: string;
  maintenance?: boolean;
  object?: string;
  objectid?: string;
  opdata?: any;
  r_eventid?: string;
  r_clock?: string;
  r_ns?: string;
  severity?: string;
  showAckButton?: boolean;
  source?: string;
  suppressed?: string;
  suppression_data?: any[];
  tags?: ZBXTag[];
  userid?: string;
}

export interface ZBXTrigger {
  acknowledges?: ZBXAcknowledge[];
  showAckButton?: boolean;
  alerts?: ZBXAlert[];
  age?: string;
  color?: string;
  comments?: string;
  correlation_mode?: string;
  correlation_tag?: string;
  datasource?: string;
  description?: string;
  error?: string;
  expression?: string;
  flags?: string;
  groups?: ZBXGroup[];
  host?: string;
  hostTechName?: string;
  hosts?: ZBXHost[];
  items?: ZBXItem[];
  lastEvent?: ZBXEvent;
  lastchange?: string;
  lastchangeUnix?: number;
  maintenance?: boolean;
  manual_close?: string;
  priority?: string;
  proxy?: string;
  recovery_expression?: string;
  recovery_mode?: string;
  severity?: string;
  state?: string;
  status?: string;
  tags?: ZBXTag[];
  templateid?: string;
  triggerid?: string;
  /** Whether the trigger can generate multiple problem events. */
  type?: string;
  url?: string;
  value?: string;
}

export interface ZBXGroup {
  groupid: string;
  name: string;
}

export interface ZBXHost {
  hostid: string;
  name: string;
  host: string;
  maintenance_status?: string;
  proxy_hostid?: string;
}

export interface ZBXItem {
  itemid: string;
  name: string;
  key_: string;
  lastvalue?: string;
}

export interface ZBXEvent {
  eventid: string;
  clock: string;
  ns?: string;
  value?: string;
  name?: string;
  source?: string;
  object?: string;
  objectid?: string;
  severity?: string;
  hosts?: ZBXHost[];
  acknowledged?: '1' | '0';
  acknowledges?: ZBXAcknowledge[];
  tags?: ZBXTag[];
  suppressed?: string;
}

export interface ZBXTag {
  tag: string;
  value?: string;
}

export interface ZBXAcknowledge {
  acknowledgeid: string;
  eventid: string;
  userid: string;
  action: string;
  clock: string;
  time: string;
  message?: string;
  user: string;
  alias: string;
  name: string;
  surname: string;
}

export interface ZBXAlert {
  eventid: string;
  clock: string;
  message: string;
  error: string;
}
