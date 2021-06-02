package datasource

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"gotest.tools/assert"
)

func TestZabbixBackend_getCachedDatasource(t *testing.T) {
	basicDsSettings := backend.DataSourceInstanceSettings{
		ID:       1,
		Name:     "TestDatasource",
		URL:      "http://zabbix.org/zabbix",
		JSONData: []byte("{}"),
	}

	modifiedDatasourceSettings := backend.DataSourceInstanceSettings{
		ID:       1,
		Name:     "TestDatasource",
		URL:      "http://another.zabbix.org/zabbix",
		JSONData: []byte("{}"),
	}
	modifiedDatasource, _ := newZabbixDatasourceInstance(modifiedDatasourceSettings)

	basicDS, _ := newZabbixDatasourceInstance(basicDsSettings)

	tests := []struct {
		name          string
		pluginContext backend.PluginContext
		want          *ZabbixDatasourceInstance
	}{
		{
			name: "Uncached Datasource (nothing in cache)",
			pluginContext: backend.PluginContext{
				OrgID:                      1,
				DataSourceInstanceSettings: &basicDsSettings,
			},
			want: basicDS.(*ZabbixDatasourceInstance),
		},
		{
			name: "Cached Datasource",
			pluginContext: backend.PluginContext{
				OrgID:                      1,
				DataSourceInstanceSettings: &basicDsSettings,
			},
			want: basicDS.(*ZabbixDatasourceInstance),
		},
		{
			name: "Cached then modified",
			pluginContext: backend.PluginContext{
				OrgID:                      1,
				DataSourceInstanceSettings: &modifiedDatasourceSettings,
			},
			want: modifiedDatasource.(*ZabbixDatasourceInstance),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ds := NewZabbixDatasource()
			got, _ := ds.getDSInstance(tt.pluginContext)

			// Only checking the URL, being the easiest value to, and guarantee equality for
			assert.Equal(t, tt.want.zabbixAPI.GetUrl().String(), got.zabbixAPI.GetUrl().String())
		})
	}
}
