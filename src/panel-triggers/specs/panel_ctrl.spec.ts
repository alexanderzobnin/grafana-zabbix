import _ from 'lodash';
import { TriggerPanelCtrl } from '../triggers_panel_ctrl';
import { PANEL_DEFAULTS, DEFAULT_TARGET } from '../triggers_panel_ctrl';

let datasourceSrvMock, zabbixDSMock;

jest.mock('@grafana/runtime', () => {
  return {
    getDataSourceSrv: () => datasourceSrvMock,
  };
}, {virtual: true});

describe('TriggerPanelCtrl', () => {
  let ctx: any = {};
  let createPanelCtrl: () => any;

  beforeEach(() => {
    ctx = { scope: {
      panel: {
        ...PANEL_DEFAULTS,
        sortProblems: 'lastchange',
      }
    }};
    ctx.scope.panel.targets = [{
      ...DEFAULT_TARGET,
      datasource: 'zabbix_default',
    }];

    zabbixDSMock = {
      zabbix: {
        getExtendedEventData: jest.fn().mockResolvedValue([]),
        getEventAlerts: jest.fn().mockResolvedValue([]),
      }
    };

    datasourceSrvMock = {
      get: () => Promise.resolve(zabbixDSMock)
    };

    const timeoutMock = (fn: () => any) => Promise.resolve(fn());
    createPanelCtrl = () => new TriggerPanelCtrl(ctx.scope, {}, timeoutMock);

    ctx.panelCtrl = createPanelCtrl();

    ctx.dataFramesReceived = generateDataFramesResponse([
      {id: "1", timestamp: "1510000010", severity: 5},
      {id: "2", timestamp: "1510000040", severity: 3},
      {id: "3", timestamp: "1510000020", severity: 4},
      {id: "4", timestamp: "1510000030", severity: 2},
    ]);
  });

  describe('When refreshing panel', () => {
    beforeEach(() => {
      ctx.scope.panel.datasources = ['zabbix_default', 'zabbix'];
      ctx.scope.panel.targets = [
        {
          ...DEFAULT_TARGET,
          datasource: 'zabbix_default'
        },
        {
          ...DEFAULT_TARGET,
          datasource: 'zabbix'
        },
      ];
      ctx.panelCtrl = createPanelCtrl();
    });

    it('should format triggers', (done) => {
      ctx.panelCtrl.onDataFramesReceived(ctx.dataFramesReceived).then(() => {
        const formattedTrigger: any = _.find(ctx.panelCtrl.renderData, {triggerid: "1"});
        expect(formattedTrigger.host).toBe('backend01');
        expect(formattedTrigger.hostTechName).toBe('backend01_tech');
        expect(formattedTrigger.datasource).toBe('zabbix_default');
        expect(formattedTrigger.maintenance).toBe(true);
        expect(formattedTrigger.lastchange).toBeTruthy();
        done();
      });
    });

    it('should sort triggers by time by default', (done) => {
      ctx.panelCtrl.onDataFramesReceived(ctx.dataFramesReceived).then(() => {
        const trigger_ids = _.map(ctx.panelCtrl.renderData, 'triggerid');
        expect(trigger_ids).toEqual([
          '2', '4', '3', '1'
        ]);
        done();
      });
    });

    it('should sort triggers by severity', (done) => {
      ctx.panelCtrl.panel.sortProblems = 'priority';
      ctx.panelCtrl.onDataFramesReceived(ctx.dataFramesReceived).then(() => {
        const trigger_ids = _.map(ctx.panelCtrl.renderData, 'triggerid');
        expect(trigger_ids).toEqual([
          '1', '3', '2', '4'
        ]);
        done();
      });
    });
  });
});

const defaultProblem: any = {
  "acknowledges": [],
  "comments": "It probably means that the systems requires\nmore physical memory.",
  "correlation_mode": "0",
  "correlation_tag": "",
  "datasource": "zabbix_default",
  "description": "Lack of free swap space on server",
  "error": "",
  "expression": "{13297}>20",
  "flags": "0",
  "groups": [
    {
      "groupid": "2",
      "name": "Linux servers"
    },
    {
      "groupid": "9",
      "name": "Backend"
    }
  ],
  "hosts": [
    {
      "host": "backend01_tech",
      "hostid": "10111",
      "maintenance_status": "1",
      "name": "backend01",
      "proxy_hostid": "0"
    }
  ],
  "items": [
    {
      "itemid": "23979",
      "key_": "system.cpu.util[,iowait]",
      "lastvalue": "25.2091",
      "name": "CPU $2 time"
    }
  ],
  "lastEvent": {
    "acknowledged": "0",
    "clock": "1589297010",
    "eventid": "4399289",
    "name": "Disk I/O is overloaded on backend01",
    "ns": "224779201",
    "object": "0",
    "objectid": "13682",
    "severity": "2",
    "source": "0",
    "value": "1"
  },
  "lastchange": "1440259530",
  "maintenance": true,
  "manual_close": "0",
  "severity": "2",
  "recovery_expression": "",
  "recovery_mode": "0",
  "showAckButton": true,
  "state": "0",
  "status": "0",
  "tags": [],
  "templateid": "13671",
  "triggerid": "13682",
  "type": "0",
  "url": "",
  "value": "1"
};

function generateDataFramesResponse(problemDescs: any[] = [{id: 1}]): any {
  const problems = problemDescs.map(problem => generateProblem(problem.id, problem.timestamp, problem.severity));

  return [
    {
      "fields": [
        {
          "config": {},
          "name": "Problems",
          "state": {
            "scopedVars": {},
            "title": null
          },
          "type": "other",
          "values": problems,
        }
      ],
      "length": 16,
      "name": "problems"
    }
  ];
}

function generateProblem(id, timestamp?, severity?): any {
  const problem = _.cloneDeep(defaultProblem);
  problem.triggerid = id.toString();
  problem.eventid = id.toString();
  if (severity) {
    problem.severity = severity.toString();
  }
  if (timestamp) {
    problem.lastchange = timestamp;
    problem.timestamp = timestamp;
  }
  return problem;
}

function getProblemById(id, ctx): any {
  return _.find(ctx.panelCtrl.renderData, {triggerid: id.toString()});
}
