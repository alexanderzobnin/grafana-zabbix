# Alerting

## Alerting overview

Grafana-Zabbix plugin introduces [alerting](https://grafana.com/docs/grafana/latest/alerting/) feature support in 4.0 release. Work still in progress, so current alerting support has some limitations:

- Only `Metrics` query mode supported.
- Queries with data processing functions are not supported.

## Creating alerts

In order to create alert, open panel query editor and switch to the `Alert` tab. Click `Create Alert` button, configure alert and save dashboard. Refer to [Grafana](https://grafana.com/docs/grafana/latest/alerting/create-alerts/) documentation for more details about alerts configuration.
