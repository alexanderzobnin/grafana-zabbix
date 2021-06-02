package datasource

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/gtime"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var (
	ErrFunctionsNotSupported      = errors.New("zabbix queries with functions are not supported")
	ErrNonMetricQueryNotSupported = errors.New("non-metrics queries are not supported")
)

type ZabbixDatasource struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
}

// ZabbixDatasourceInstance stores state about a specific datasource
// and provides methods to make requests to the Zabbix API
type ZabbixDatasourceInstance struct {
	zabbixAPI  *zabbixapi.ZabbixAPI
	dsInfo     *backend.DataSourceInstanceSettings
	Settings   *ZabbixDatasourceSettings
	queryCache *DatasourceCache
	logger     log.Logger
}

func NewZabbixDatasource() *ZabbixDatasource {
	im := datasource.NewInstanceManager(newZabbixDatasourceInstance)
	return &ZabbixDatasource{
		im:     im,
		logger: log.New(),
	}
}

// newZabbixDatasourceInstance returns an initialized zabbix datasource instance
func newZabbixDatasourceInstance(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	logger := log.New()
	logger.Debug("Initializing new data source instance")

	zabbixSettings, err := readZabbixSettings(&settings)
	if err != nil {
		logger.Error("Error parsing Zabbix settings", "error", err)
		return nil, err
	}

	zabbixAPI, err := zabbixapi.New(&settings, zabbixSettings.Timeout)
	if err != nil {
		logger.Error("Error initializing Zabbix API", "error", err)
		return nil, err
	}

	return &ZabbixDatasourceInstance{
		dsInfo:     &settings,
		zabbixAPI:  zabbixAPI,
		Settings:   zabbixSettings,
		queryCache: NewDatasourceCache(zabbixSettings.CacheTTL, 10*time.Minute),
		logger:     logger,
	}, nil
}

// CheckHealth checks if the plugin is running properly
func (ds *ZabbixDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	res := &backend.CheckHealthResult{}

	dsInstance, err := ds.getDSInstance(req.PluginContext)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = "Error getting datasource instance"
		ds.logger.Error("Error getting datasource instance", "err", err)
		return res, nil
	}

	message, err := dsInstance.TestConnection(ctx)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = err.Error()
		ds.logger.Error("Error connecting Zabbix server", "err", err)
		return res, nil
	}

	res.Status = backend.HealthStatusOk
	res.Message = message
	return res, nil
}

func (ds *ZabbixDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	qdr := backend.NewQueryDataResponse()

	zabbixDS, err := ds.getDSInstance(req.PluginContext)
	if err != nil {
		return nil, err
	}

	for _, q := range req.Queries {
		res := backend.DataResponse{}
		query, err := ReadQuery(q)
		ds.logger.Debug("DS query", "query", q)
		if err != nil {
			res.Error = err
		} else if len(query.Functions) > 0 {
			res.Error = ErrFunctionsNotSupported
		} else if query.Mode != 0 {
			res.Error = ErrNonMetricQueryNotSupported
		} else {
			frame, err := zabbixDS.queryNumericItems(ctx, &query)
			if err != nil {
				res.Error = err
			} else {
				res.Frames = []*data.Frame{frame}
			}
		}
		qdr.Responses[q.RefID] = res
	}

	return qdr, nil
}

// getDSInstance Returns cached datasource or creates new one
func (ds *ZabbixDatasource) getDSInstance(pluginContext backend.PluginContext) (*ZabbixDatasourceInstance, error) {
	instance, err := ds.im.Get(pluginContext)
	if err != nil {
		return nil, err
	}
	return instance.(*ZabbixDatasourceInstance), nil
}

func readZabbixSettings(dsInstanceSettings *backend.DataSourceInstanceSettings) (*ZabbixDatasourceSettings, error) {
	zabbixSettingsDTO := &ZabbixDatasourceSettingsDTO{}

	err := json.Unmarshal(dsInstanceSettings.JSONData, &zabbixSettingsDTO)
	if err != nil {
		return nil, err
	}

	if zabbixSettingsDTO.TrendsFrom == "" {
		zabbixSettingsDTO.TrendsFrom = "7d"
	}
	if zabbixSettingsDTO.TrendsRange == "" {
		zabbixSettingsDTO.TrendsRange = "4d"
	}
	if zabbixSettingsDTO.CacheTTL == "" {
		zabbixSettingsDTO.CacheTTL = "1h"
	}

	if zabbixSettingsDTO.Timeout == "" {
		zabbixSettingsDTO.Timeout = "30"
	}

	trendsFrom, err := gtime.ParseInterval(zabbixSettingsDTO.TrendsFrom)
	if err != nil {
		return nil, err
	}

	trendsRange, err := gtime.ParseInterval(zabbixSettingsDTO.TrendsRange)
	if err != nil {
		return nil, err
	}

	cacheTTL, err := gtime.ParseInterval(zabbixSettingsDTO.CacheTTL)
	if err != nil {
		return nil, err
	}

	timeout, err := strconv.Atoi(zabbixSettingsDTO.Timeout)
	if err != nil {
		return nil, errors.New("failed to parse timeout: " + err.Error())
	}

	zabbixSettings := &ZabbixDatasourceSettings{
		Trends:      zabbixSettingsDTO.Trends,
		TrendsFrom:  trendsFrom,
		TrendsRange: trendsRange,
		CacheTTL:    cacheTTL,
		Timeout:     time.Duration(timeout) * time.Second,
	}

	return zabbixSettings, nil
}
