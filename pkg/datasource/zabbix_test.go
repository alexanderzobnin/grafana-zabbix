package datasource

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/cache"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
)

var emptyParams = map[string]interface{}{}

type RoundTripFunc func(req *http.Request) *http.Response

func (f RoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req), nil
}

//NewTestClient returns *http.Client with Transport replaced to avoid making real calls
func NewTestClient(fn RoundTripFunc) *http.Client {
	return &http.Client{
		Transport: RoundTripFunc(fn),
	}
}

var basicDatasourceInfo = &backend.DataSourceInstanceSettings{
	ID:       1,
	Name:     "TestDatasource",
	URL:      "http://zabbix.org/zabbix",
	JSONData: []byte(`{"username":"username", "password":"password"}}`),
}

func mockZabbixQuery(method string, params ZabbixAPIParams) *ZabbixAPIRequest {
	return &ZabbixAPIRequest{
		Method: method,
		Params: params,
	}
}

func MockZabbixDataSource(body string, statusCode int) *ZabbixDatasourceInstance {
	zabbixAPI, _ := zabbixapi.MockZabbixAPI(body, statusCode)
	zabbixSettings, _ := readZabbixSettings(basicDatasourceInfo)

	return &ZabbixDatasourceInstance{
		dsInfo:     basicDatasourceInfo,
		zabbixAPI:  zabbixAPI,
		Settings:   zabbixSettings,
		queryCache: NewDatasourceCache(cache.NoExpiration, 10*time.Minute),
		logger:     log.New(),
	}
}

func MockZabbixDataSourceResponse(dsInstance *ZabbixDatasourceInstance, body string, statusCode int) *ZabbixDatasourceInstance {
	zabbixAPI, _ := zabbixapi.MockZabbixAPI(body, statusCode)
	dsInstance.zabbixAPI = zabbixAPI

	return dsInstance
}

func TestLogin(t *testing.T) {
	dsInstance := MockZabbixDataSource(`{"result":"secretauth"}`, 200)
	err := dsInstance.login(context.Background())

	assert.Nil(t, err)
	assert.Equal(t, "secretauth", dsInstance.zabbixAPI.GetAuth())
}

func TestLoginError(t *testing.T) {
	dsInstance := MockZabbixDataSource(`{"result":""}`, 500)
	err := dsInstance.login(context.Background())

	assert.NotNil(t, err)
	assert.Equal(t, "", dsInstance.zabbixAPI.GetAuth())
}

func TestZabbixAPIQuery(t *testing.T) {
	dsInstance := MockZabbixDataSource(`{"result":"test"}`, 200)
	resp, err := dsInstance.ZabbixAPIQuery(context.Background(), mockZabbixQuery("test.get", emptyParams))

	assert.Nil(t, err)

	result, ok := resp.Result.(string)
	assert.True(t, ok)
	assert.Equal(t, "test", result)
}

func TestCachedQuery(t *testing.T) {
	// Using methods with caching enabled
	query := mockZabbixQuery("host.get", emptyParams)
	dsInstance := MockZabbixDataSource(`{"result":"testOld"}`, 200)

	// Run query first time
	resp, err := dsInstance.ZabbixAPIQuery(context.Background(), query)

	assert.Nil(t, err)
	result, _ := resp.Result.(string)
	assert.Equal(t, "testOld", result)

	// Mock request with new value
	dsInstance = MockZabbixDataSourceResponse(dsInstance, `{"result":"testNew"}`, 200)
	// Should not run actual API query and return first result
	resp, err = dsInstance.ZabbixAPIQuery(context.Background(), query)

	assert.Nil(t, err)
	result, _ = resp.Result.(string)
	assert.Equal(t, "testOld", result)
}

func TestNonCachedQuery(t *testing.T) {
	// Using methods with caching disabled
	query := mockZabbixQuery("history.get", emptyParams)
	dsInstance := MockZabbixDataSource(`{"result":"testOld"}`, 200)

	// Run query first time
	resp, err := dsInstance.ZabbixAPIQuery(context.Background(), query)

	assert.Nil(t, err)
	result, _ := resp.Result.(string)
	assert.Equal(t, "testOld", result)

	// Mock request with new value
	dsInstance = MockZabbixDataSourceResponse(dsInstance, `{"result":"testNew"}`, 200)
	// Should not run actual API query and return first result
	resp, err = dsInstance.ZabbixAPIQuery(context.Background(), query)

	assert.Nil(t, err)
	result, _ = resp.Result.(string)
	assert.Equal(t, "testNew", result)
}
