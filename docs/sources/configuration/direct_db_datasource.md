# Direct DB Data Source Configuration

## Security notes

Grafana-Zabbix plugin can use MySQL, Postgres or InfluxDB (if Zabbix configured to store history data in InfluxDB) data sources to query history and trend data directly from Zabbix database. In order to execute queries, plugin needs only read access to the `history`, `history_uint`, `trends` and `trends_uint` tables. To make connection more secure and prevent unnecessary data disclosure, it's highly recommended to grant read access to only that tables. But if you want to use this data source for querying another data, you can
grant `SELECT` privileges to entire zabbix database. Also, all queries are invoked by grafana server, so you can restrict connection to only grafana host. Here's MySQL example:

```sql
GRANT SELECT ON zabbix.* TO 'grafana'@'grafana-host' identified by 'password';
```

## MySQL

In order to use _Direct DB Connection_ feature you should configure SQL data source first.

![Configure MySQL data source](../img/installation-mysql_ds_config.png)

Select _MySQL_ data source type and provide your database host address and port (3306 is default for MySQL). Fill
database name (usually, `zabbix`) and specify credentials.

## PostgreSQL

Select _PostgreSQL_ data source type and provide your database host address and port (5432 is default). Fill
database name (usually, `zabbix`) and specify credentials.

![Configure PostgreSQL data source](../img/installation-postgres_ds_config.png)

## InfluxDB

Select _InfluxDB_ data source type and provide your InfluxDB instance host address and port (8086 is default). Fill
database name you configured in the [effluence](https://github.com/i-ky/effluence) module config (usually, `zabbix`) and specify credentials.

![Configure InfluxDB data source](../img/configuration-influxdb_ds_config.png)
