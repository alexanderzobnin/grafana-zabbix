// Data point
export const DATAPOINT_VALUE = 0;
export const DATAPOINT_TS = 1;

// Editor modes
export const MODE_METRICS = 0;
export const MODE_ITSERVICE = 1;
export const MODE_TEXT = 2;
export const MODE_ITEMID = 3;
export const MODE_TRIGGERS = 4;
export const MODE_MAP = 5;

// Triggers severity
export const SEV_NOT_CLASSIFIED = 0;
export const SEV_INFORMATION = 1;
export const SEV_WARNING = 2;
export const SEV_AVERAGE = 3;
export const SEV_HIGH = 4;
export const SEV_DISASTER = 5;

export const SHOW_ALL_TRIGGERS = [0, 1];
export const SHOW_ALL_EVENTS = [0, 1];
export const SHOW_OK_EVENTS = 1;

// Acknowledge
export const ZBX_ACK_ACTION_NONE = 0;
export const ZBX_ACK_ACTION_ACK = 2;
export const ZBX_ACK_ACTION_ADD_MESSAGE = 4;

export const TRIGGER_SEVERITY = [
  {val: 0, text: 'Not classified'},
  {val: 1, text: 'Information'},
  {val: 2, text: 'Warning'},
  {val: 3, text: 'Average'},
  {val: 4, text: 'High'},
  {val: 5, text: 'Disaster'}
];

/** Minimum interval for SLA over time (1 hour) */
export const MIN_SLA_INTERVAL = 3600;

export const RANGE_VARIABLE_VALUE = 'range_series';
