page_title: Grafana-Zabbix Installation
page_description: Installation instructions for Grafana-Zabbix.

# Installation

## Choosing plugin version

Currently (in version `4.x.x`) Grafana-Zabbix plugin supports Zabbix versions `4.x` and `5.x`. Zabbix `3.x` is not supported anymore. Generally, latest plugin should work with latest Grafana version, but if you have any compatibility issue, try to downgrade to previous minor release of Grafana. It's also helpful to report (but use search first to avoid duplicating issues) compatibility issues to the [GitHub](https://github.com/alexanderzobnin/grafana-zabbix/issues).

## Using grafana-cli tool

Get list of available plugins

```sh
grafana-cli plugins list-remote
```

Install zabbix plugin

```sh
grafana-cli plugins install alexanderzobnin-zabbix-app
```

Restart grafana after installing plugins
```sh
systemctl restart grafana-server
```

Read more about installing plugins in [Grafana docs](https://grafana.com/docs/plugins/installation/)

**WARNING!** The only reliable installation method is `grafana-cli`. Any other way should be treated as a workaround and doesn't provide any backward-compatibility guaranties.

## From github releases

Starting from version 4.0, each plugin release on GitHub contains packaged plugin. To install it, go to [releases](https://github.com/alexanderzobnin/grafana-zabbix/releases) page, pick release you want to get and click on `Assests`. Built plugin packaged into `zip` archive having name `alexanderzobnin-zabbix-app-x.x.x.zip`. Download it, unpack into your Grafana plugins directory and restart grafana server. Each plugin package contains [digital signature](https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/) which allows Grafana to verify that plugin was published by it's owner and files are not modified.

**Note**: `since` plugin version 4.0, `grafana-cli` downloads plugin from GitHub release. So downloading plugin package manually, you get the same package as via `grafana-cli`.

## From github repo
**WARNING!** This way doesn't work anymore (`dist/` folder was removed from git). Use `grafana-cli` or build plugin from sources.

## Building from sources

If you want to build a package yourself, or contribute - read [building instructions](./run_from_master).
