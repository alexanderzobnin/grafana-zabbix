# Plugin development

### Debugging backend plugin

For debugging backend part written on Go, you should go through a few steps. First, build a plugin with special flags for debugging:

```sh
make build-debug
```

Then, configure your editor to connect to [delve](https://github.com/go-delve/delve) debugger running in headless mode. This is an example for VS Code:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug backend plugin",
      "type": "go",
      "request": "attach",
      "mode": "remote",
      "port": 3222,
      "host": "127.0.0.1",
    },
  ]
}
```

Finally, run grafana-server and then execute `./debug-backend.sh` from grafana-zabbix root folder. This script will attach delve to running plugin. Now you can go to the VS Code and run _Debug backend plugin_ debug config.
