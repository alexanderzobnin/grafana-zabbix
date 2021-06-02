package main

import (
	"net/http"
	"os"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

const ZABBIX_PLUGIN_ID = "alexanderzobnin-zabbix-datasource"

func main() {
	backend.SetupPluginEnvironment(ZABBIX_PLUGIN_ID)

	pluginLogger := log.New()
	mux := http.NewServeMux()
	ds := Init(pluginLogger, mux)
	httpResourceHandler := httpadapter.New(mux)

	pluginLogger.Debug("Starting Zabbix datasource")

	err := backend.Serve(backend.ServeOpts{
		CallResourceHandler: httpResourceHandler,
		QueryDataHandler:    ds,
		CheckHealthHandler:  ds,
	})
	if err != nil {
		pluginLogger.Error("Error starting Zabbix datasource", "error", err.Error())
	}
}

func Init(logger log.Logger, mux *http.ServeMux) *datasource.ZabbixDatasource {
	variableName := "GFX_ZABBIX_DATA_PATH"
	path, exist := os.LookupEnv(variableName)
	if !exist {
		logger.Debug("Could not read environment variable", variableName)
	} else {
		logger.Debug("Environment variable for storage found", "variable", variableName, "value", path)
	}

	ds := datasource.NewZabbixDatasource()

	mux.HandleFunc("/", ds.RootHandler)
	mux.HandleFunc("/zabbix-api", ds.ZabbixAPIHandler)
	// mux.Handle("/scenarios", getScenariosHandler(logger))

	return ds
}
