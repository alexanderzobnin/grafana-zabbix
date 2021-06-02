page_title: Provisioning Grafana-Zabbix plugin
page_description: Grafana-Zabbix plugin provisioning instructions.

# Provisioning Grafana-Zabbix plugin

It’s now possible to configure datasources using config files with Grafana’s provisioning system. You can read more about how it works and all the settings you can set for datasources on the [provisioning docs page](http://docs.grafana.org/administration/provisioning/#datasources)

### Example Datasource Config File

```yaml
apiVersion: 1

datasources:
- name: Zabbix
  type: alexanderzobnin-zabbix-datasource
  access: proxy
  url: http://localhost/zabbix/api_jsonrpc.php
  isDefault: true
  jsonData:
    # Zabbix API credentials
    username: zabbix
    password: zabbix
    # Trends options
    trends: true
    trendsFrom: "7d"
    trendsRange: "4d"
    # Cache update interval
    cacheTTL: "1h"
    # Alerting options
    alerting: true
    addThresholds: false
    alertingMinSeverity: 3
    # Direct DB Connection options
    dbConnectionEnable: true
    # Name of existing datasource for Direct DB Connection
    dbConnectionDatasourceName: MySQL Zabbix
    # Retention policy name (InfluxDB only) for fetching long-term stored data.
    # Leave it blank if only default retention policy used.
    dbConnectionRetentionPolicy: one_year
    # Disable acknowledges for read-only users
    disableReadOnlyUsersAck: true
    # Disable time series data alignment
    disableDataAlignment: false
    # Use value mapping from Zabbix
    useZabbixValueMapping: true
  version: 1
  editable: false

- name: MySQL Zabbix
  type: mysql
  url: localhost:3306
  database: zabbix
  user: grafana
  password: password
```
