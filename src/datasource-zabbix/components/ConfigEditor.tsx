import React, { useEffect, useState } from 'react';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings, SelectableValue } from '@grafana/data';
import { DataSourceHttpSettings, LegacyForms, Field, Input, Button, InlineFormLabel, Select } from '@grafana/ui';
const { FormField, Switch } = LegacyForms;
import { ZabbixDSOptions, ZabbixSecureJSONData } from '../types';

const SUPPORTED_SQL_DS = ['mysql', 'postgres', 'influxdb'];

export type Props = DataSourcePluginOptionsEditorProps<ZabbixDSOptions, ZabbixSecureJSONData>;
export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;

  const [selectedDBDatasource, setSelectedDBDatasource] = useState(null);
  const [currentDSType, setCurrentDSType] = useState('');

  // Apply some defaults on initial render
  useEffect(() => {
    const { jsonData, secureJsonFields } = options;

    // Set secureJsonFields.password to password and then remove it from config
    const { password, ...restJsonData } = jsonData;
    if (!secureJsonFields?.password) {
      if (!options.secureJsonData) {
        options.secureJsonData = {};
      }
      options.secureJsonData.password = password;
    }

    onOptionsChange({
      ...options,
      jsonData: {
        trends: true,
        trendsFrom: '',
        trendsRange: '',
        cacheTTL: '',
        timeout: '',
        disableDataAlignment: false,
        ...restJsonData,
      },
    });

    if (options.jsonData.dbConnectionEnable) {
      if (!options.jsonData.dbConnectionDatasourceId) {
        const dsName = options.jsonData.dbConnectionDatasourceName;
        getDataSourceSrv().get(dsName)
        .then(ds => {
          if (ds) {
            const selectedDs = getDirectDBDatasources().find(dsOption => dsOption.id === ds.id);
            setSelectedDBDatasource({ label: selectedDs.name, value: selectedDs.id });
            setCurrentDSType(selectedDs.type);
            onOptionsChange({
              ...options,
              jsonData: {
                ...options.jsonData,
                dbConnectionDatasourceId: ds.id,
              },
            });
          }
        });
      } else {
        const selectedDs = getDirectDBDatasources().find(dsOption => dsOption.id === options.jsonData.dbConnectionDatasourceId);
        setSelectedDBDatasource({ label: selectedDs.name, value: selectedDs.id });
        setCurrentDSType(selectedDs.type);
      }
    }
  }, []);

  return (
    <>
      <DataSourceHttpSettings
        defaultUrl={'http://localhost/zabbix/api_jsonrpc.php'}
        dataSourceConfig={options}
        showAccessOptions={true}
        onChange={onOptionsChange}
      />

      <div className="gf-form-group">
        <h3 className="page-heading">Zabbix API details</h3>
        <div className="gf-form max-width-25">
          <FormField
            labelWidth={7}
            inputWidth={15}
            label="Username"
            value={options.jsonData.username || ''}
            onChange={jsonDataChangeHandler('username', options, onOptionsChange)}
            required
          />
        </div>
        <div className="gf-form max-width-25">
          {options.secureJsonFields?.password ?
            <>
              <FormField
                labelWidth={7}
                inputWidth={15}
                label="Password"
                disabled={true}
                value=""
                placeholder="Configured"
              />
              <Button onClick={resetSecureJsonField('password', options, onOptionsChange)}>Reset</Button>
            </>:
            <FormField
              labelWidth={7}
              inputWidth={15}
              label="Password"
              type="password"
              value={options.secureJsonData?.password || options.jsonData.password || ''}
              onChange={secureJsonDataChangeHandler('password', options, onOptionsChange)}
              required
            />
          }
        </div>
        <Switch
          label="Trends"
          labelClass="width-7"
          checked={options.jsonData.trends}
          onChange={jsonDataSwitchHandler('trends', options, onOptionsChange)}
        />
        {options.jsonData.trends &&
          <>
            <div className="gf-form">
              <FormField
                labelWidth={7}
                inputWidth={4}
                label="After"
                value={options.jsonData.trendsFrom || ''}
                placeholder="7d"
                onChange={jsonDataChangeHandler('trendsFrom', options, onOptionsChange)}
                tooltip="Time after which trends will be used.
                  Best practice is to set this value to your history storage period (7d, 30d, etc)."
              />
            </div>
            <div className="gf-form">
              <FormField
                labelWidth={7}
                inputWidth={4}
                label="Range"
                value={options.jsonData.trendsRange || ''}
                placeholder="4d"
                onChange={jsonDataChangeHandler('trendsRange', options, onOptionsChange)}
                tooltip="Time range width after which trends will be used instead of history.
                  It's better to set this value in range of 4 to 7 days to prevent loading large amount of history data."
              />
            </div>
          </>
        }
        <div className="gf-form">
          <FormField
            labelWidth={7}
            inputWidth={4}
            label="Cache TTL"
            value={options.jsonData.cacheTTL || ''}
            placeholder="1h"
            onChange={jsonDataChangeHandler('cacheTTL', options, onOptionsChange)}
            tooltip="Zabbix data source caches metric names in memory. Specify how often data will be updated."
          />
        </div>
        <div className="gf-form">
          <FormField
            labelWidth={7}
            inputWidth={4}
            label="Timeout"
            value={options.jsonData.timeout || ''}
            placeholder="30"
            onChange={jsonDataChangeHandler('timeout', options, onOptionsChange)}
            tooltip="Zabbix API connection timeout in seconds. Default is 30."
          />
        </div>
      </div>

      <div className="gf-form-group">
        <h3 className="page-heading">Direct DB Connection</h3>
        <Switch
          label="Enable"
          labelClass="width-9"
          checked={options.jsonData.dbConnectionEnable}
          onChange={jsonDataSwitchHandler('dbConnectionEnable', options, onOptionsChange)}
        />
        {options.jsonData.dbConnectionEnable &&
          <>
            <div className="gf-form">
              <InlineFormLabel width={9}>Data Source</InlineFormLabel>
              <Select
                width={32}
                options={getDirectDBDSOptions()}
                value={selectedDBDatasource}
                onChange={directDBDatasourceChanegeHandler(options, onOptionsChange, setSelectedDBDatasource, setCurrentDSType)}
              />
            </div>
            {currentDSType === 'influxdb' &&
              <div className="gf-form">
                <FormField
                  labelWidth={9}
                  inputWidth={16}
                  label="Retention Policy"
                  value={options.jsonData.dbConnectionRetentionPolicy || ''}
                  placeholder="Retention policy name"
                  onChange={jsonDataChangeHandler('dbConnectionRetentionPolicy', options, onOptionsChange)}
                  tooltip="Specify retention policy name for fetching long-term stored data (optional).
                    Leave it blank if only default retention policy used."
                />
              </div>
            }
          </>
        }
      </div>

      <div className="gf-form-group">
        <h3 className="page-heading">Other</h3>
        <Switch
          label="Disable acknowledges for read-only users"
          labelClass="width-16"
          checked={options.jsonData.disableReadOnlyUsersAck}
          onChange={jsonDataSwitchHandler('disableReadOnlyUsersAck', options, onOptionsChange)}
        />
        <Switch
          label="Disable data alignment"
          labelClass="width-16"
          checked={!!options.jsonData.disableDataAlignment}
          onChange={jsonDataSwitchHandler('disableDataAlignment', options, onOptionsChange)}
          tooltip="Data alignment feature aligns points based on item update interval.
            For instance, if value collected once per minute, then timestamp of the each point will be set to the start of corresponding minute.
            This alignment required for proper work of the stacked graphs.
            If you don't need stacked graphs and want to get exactly the same timestamps as in Zabbix, then you can disable this feature."
        />
      </div>
    </>
  );
};

const jsonDataChangeHandler = (
  key: keyof ZabbixDSOptions,
  value: DataSourceSettings<ZabbixDSOptions, ZabbixSecureJSONData>,
  onChange: Props['onOptionsChange']
) => (
  event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>
) => {
  onChange({
    ...value,
    jsonData: {
      ...value.jsonData,
      [key]: event.currentTarget.value,
    },
  });
};

const jsonDataSwitchHandler = (
  key: keyof ZabbixDSOptions,
  value: DataSourceSettings<ZabbixDSOptions, ZabbixSecureJSONData>,
  onChange: Props['onOptionsChange']
) => (
  event: React.SyntheticEvent<HTMLInputElement>
) => {
  onChange({
    ...value,
    jsonData: {
      ...value.jsonData,
      [key]: (event.target as HTMLInputElement).checked,
    },
  });
};

const secureJsonDataChangeHandler = (
  key: keyof ZabbixDSOptions,
  value: DataSourceSettings<ZabbixDSOptions, ZabbixSecureJSONData>,
  onChange: Props['onOptionsChange']
) => (
  event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>
) => {
  onChange({
    ...value,
    secureJsonData: {
      ...value.secureJsonData,
      [key]: event.currentTarget.value,
    },
  });
};

const resetSecureJsonField = (
  key: keyof ZabbixDSOptions,
  value: DataSourceSettings<ZabbixDSOptions, ZabbixSecureJSONData>,
  onChange: Props['onOptionsChange']
) => (
  event: React.SyntheticEvent<HTMLButtonElement>
) => {
  onChange({
    ...value,
    secureJsonFields: {
      ...value.secureJsonFields,
      [key]: false,
    },
  });
};

const directDBDatasourceChanegeHandler = (
  options: DataSourceSettings<ZabbixDSOptions, ZabbixSecureJSONData>,
  onChange: Props['onOptionsChange'],
  setSelectedDS: React.Dispatch<any>,
  setSelectedDSType: React.Dispatch<any>,
) => (
  value: SelectableValue<number>
) => {
  const selectedDs = getDirectDBDatasources().find(dsOption => dsOption.id === value.value);
  setSelectedDS({ label: selectedDs.name, value: selectedDs.id });
  setSelectedDSType(selectedDs.type);
  onChange({
    ...options,
    jsonData: {
      ...options.jsonData,
      dbConnectionDatasourceId: value.value
    },
  });
};

const getDirectDBDatasources = () => {
  let dsList = (getDataSourceSrv() as any).getAll();
  dsList = dsList.filter(ds => SUPPORTED_SQL_DS.includes(ds.type));
  return dsList;
};

const getDirectDBDSOptions = () => {
  const dsList = getDirectDBDatasources();
  const dsOpts: Array<SelectableValue<number>> = dsList.map(ds => ({ label: ds.name, value: ds.id, description: ds.type }));
  return dsOpts;
};
