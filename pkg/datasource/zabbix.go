package datasource

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"
	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"golang.org/x/net/context"
)

var CachedMethods = map[string]bool{
	"hostgroup.get":   true,
	"host.get":        true,
	"application.get": true,
	"item.get":        true,
	"service.get":     true,
	"usermacro.get":   true,
	"proxy.get":       true,
}

// ZabbixQuery handles query requests to Zabbix
func (ds *ZabbixDatasourceInstance) ZabbixQuery(ctx context.Context, apiReq *ZabbixAPIRequest) (*simplejson.Json, error) {
	var resultJson *simplejson.Json
	var err error

	cachedResult, queryExistInCache := ds.queryCache.GetAPIRequest(apiReq)
	if !queryExistInCache {
		resultJson, err = ds.ZabbixRequest(ctx, apiReq.Method, apiReq.Params)
		if err != nil {
			return nil, err
		}

		if _, ok := CachedMethods[apiReq.Method]; ok {
			ds.logger.Debug("Writing result to cache", "method", apiReq.Method)
			ds.queryCache.SetAPIRequest(apiReq, resultJson)
		}
	} else {
		var ok bool
		resultJson, ok = cachedResult.(*simplejson.Json)
		if !ok {
			resultJson = simplejson.New()
		}
	}

	return resultJson, nil
}

// ZabbixAPIQuery handles query requests to Zabbix API
func (ds *ZabbixDatasourceInstance) ZabbixAPIQuery(ctx context.Context, apiReq *ZabbixAPIRequest) (*ZabbixAPIResourceResponse, error) {
	resultJson, err := ds.ZabbixQuery(ctx, apiReq)
	if err != nil {
		return nil, err
	}
	result := resultJson.Interface()
	return BuildAPIResponse(&result)
}

func BuildAPIResponse(responseData *interface{}) (*ZabbixAPIResourceResponse, error) {
	return &ZabbixAPIResourceResponse{
		Result: *responseData,
	}, nil
}

// TestConnection checks authentication and version of the Zabbix API and returns that info
func (ds *ZabbixDatasourceInstance) TestConnection(ctx context.Context) (string, error) {
	_, err := ds.getAllGroups(ctx)
	if err != nil {
		return "", err
	}

	response, err := ds.ZabbixRequest(ctx, "apiinfo.version", ZabbixAPIParams{})
	if err != nil {
		return "", err
	}

	resultByte, _ := response.MarshalJSON()
	return string(resultByte), nil
}

// ZabbixRequest checks authentication and makes a request to the Zabbix API
func (ds *ZabbixDatasourceInstance) ZabbixRequest(ctx context.Context, method string, params ZabbixAPIParams) (*simplejson.Json, error) {
	ds.logger.Debug("Zabbix API request", "datasource", ds.dsInfo.Name, "method", method)
	var result *simplejson.Json
	var err error

	// Skip auth for methods that are not required it
	if method == "apiinfo.version" {
		return ds.zabbixAPI.RequestUnauthenticated(ctx, method, params)
	}

	result, err = ds.zabbixAPI.Request(ctx, method, params)
	notAuthorized := isNotAuthorized(err)
	if err == zabbixapi.ErrNotAuthenticated || notAuthorized {
		if notAuthorized {
			ds.logger.Debug("Authentication token expired, performing re-login")
		}
		err = ds.login(ctx)
		if err != nil {
			return nil, err
		}
		return ds.ZabbixRequest(ctx, method, params)
	} else if err != nil {
		return nil, err
	}

	return result, err
}

func (ds *ZabbixDatasourceInstance) login(ctx context.Context) error {
	jsonData, err := simplejson.NewJson(ds.dsInfo.JSONData)
	if err != nil {
		return err
	}

	zabbixLogin := jsonData.Get("username").MustString()
	var zabbixPassword string
	if securePassword, exists := ds.dsInfo.DecryptedSecureJSONData["password"]; exists {
		zabbixPassword = securePassword
	} else {
		// Fallback
		zabbixPassword = jsonData.Get("password").MustString()
	}

	err = ds.zabbixAPI.Authenticate(ctx, zabbixLogin, zabbixPassword)
	if err != nil {
		ds.logger.Error("Zabbix authentication error", "error", err)
		return err
	}
	ds.logger.Debug("Successfully authenticated", "url", ds.zabbixAPI.GetUrl().String(), "user", zabbixLogin)

	return nil
}

func (ds *ZabbixDatasourceInstance) queryNumericItems(ctx context.Context, query *QueryModel) (*data.Frame, error) {
	groupFilter := query.Group.Filter
	hostFilter := query.Host.Filter
	appFilter := query.Application.Filter
	itemFilter := query.Item.Filter

	items, err := ds.getItems(ctx, groupFilter, hostFilter, appFilter, itemFilter, "num")
	if err != nil {
		return nil, err
	}

	frames, err := ds.queryNumericDataForItems(ctx, query, items)
	if err != nil {
		return nil, err
	}

	return frames, nil
}

func (ds *ZabbixDatasourceInstance) getItems(ctx context.Context, groupFilter string, hostFilter string, appFilter string, itemFilter string, itemType string) (Items, error) {
	hosts, err := ds.getHosts(ctx, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	var hostids []string
	for _, k := range hosts {
		hostids = append(hostids, k["hostid"].(string))
	}

	apps, err := ds.getApps(ctx, groupFilter, hostFilter, appFilter)
	// Apps not supported in Zabbix 5.4 and higher
	if isAppMethodNotFoundError(err) {
		apps = []map[string]interface{}{}
	} else if err != nil {
		return nil, err
	}
	var appids []string
	for _, l := range apps {
		appids = append(appids, l["applicationid"].(string))
	}

	var allItems *simplejson.Json
	if len(hostids) > 0 {
		allItems, err = ds.getAllItems(ctx, hostids, nil, itemType)
	} else if len(appids) > 0 {
		allItems, err = ds.getAllItems(ctx, nil, appids, itemType)
	}

	var items Items

	if allItems == nil {
		items = Items{}
	} else {
		itemsJSON, err := allItems.MarshalJSON()
		if err != nil {
			return nil, err
		}

		err = json.Unmarshal(itemsJSON, &items)
		if err != nil {
			return nil, err
		}
	}

	re, err := parseFilter(itemFilter)
	if err != nil {
		return nil, err
	}

	filteredItems := Items{}
	for _, item := range items {
		itemName := item.ExpandItem()
		if item.Status == "0" {
			if re != nil {
				if re.MatchString(itemName) {
					filteredItems = append(filteredItems, item)
				}
			} else if itemName == itemFilter {
				filteredItems = append(filteredItems, item)
			}
		}
	}
	return filteredItems, nil
}

func (ds *ZabbixDatasourceInstance) getApps(ctx context.Context, groupFilter string, hostFilter string, appFilter string) ([]map[string]interface{}, error) {
	hosts, err := ds.getHosts(ctx, groupFilter, hostFilter)
	if err != nil {
		return nil, err
	}
	var hostids []string
	for _, k := range hosts {
		hostids = append(hostids, k["hostid"].(string))
	}
	allApps, err := ds.getAllApps(ctx, hostids)
	if err != nil {
		return nil, err
	}

	re, err := parseFilter(appFilter)
	if err != nil {
		return nil, err
	}

	var apps []map[string]interface{}
	for _, i := range allApps.MustArray() {
		name := i.(map[string]interface{})["name"].(string)
		if re != nil {
			if re.MatchString(name) {
				apps = append(apps, i.(map[string]interface{}))
			}
		} else if name == appFilter {
			apps = append(apps, i.(map[string]interface{}))
		}
	}
	return apps, nil
}

func (ds *ZabbixDatasourceInstance) getHosts(ctx context.Context, groupFilter string, hostFilter string) ([]map[string]interface{}, error) {
	groups, err := ds.getGroups(ctx, groupFilter)
	if err != nil {
		return nil, err
	}
	var groupids []string
	for _, k := range groups {
		groupids = append(groupids, k["groupid"].(string))
	}
	allHosts, err := ds.getAllHosts(ctx, groupids)
	if err != nil {
		return nil, err
	}

	re, err := parseFilter(hostFilter)
	if err != nil {
		return nil, err
	}

	var hosts []map[string]interface{}
	for _, i := range allHosts.MustArray() {
		name := i.(map[string]interface{})["name"].(string)
		if re != nil {
			if re.MatchString(name) {
				hosts = append(hosts, i.(map[string]interface{}))
			}
		} else if name == hostFilter {
			hosts = append(hosts, i.(map[string]interface{}))
		}

	}

	return hosts, nil
}

func (ds *ZabbixDatasourceInstance) getGroups(ctx context.Context, groupFilter string) ([]map[string]interface{}, error) {
	allGroups, err := ds.getAllGroups(ctx)
	if err != nil {
		return nil, err
	}
	re, err := parseFilter(groupFilter)
	if err != nil {
		return nil, err
	}

	var groups []map[string]interface{}
	for _, i := range allGroups.MustArray() {
		name := i.(map[string]interface{})["name"].(string)
		if re != nil {
			if re.MatchString(name) {
				groups = append(groups, i.(map[string]interface{}))
			}
		} else if name == groupFilter {
			groups = append(groups, i.(map[string]interface{}))
		}
	}
	return groups, nil
}

func (ds *ZabbixDatasourceInstance) getAllItems(ctx context.Context, hostids []string, appids []string, itemtype string) (*simplejson.Json, error) {
	params := ZabbixAPIParams{
		"output":         []string{"itemid", "name", "key_", "value_type", "hostid", "status", "state"},
		"sortfield":      "name",
		"webitems":       true,
		"filter":         map[string]interface{}{},
		"selectHosts":    []string{"hostid", "name"},
		"hostids":        hostids,
		"applicationids": appids,
	}

	filter := params["filter"].(map[string]interface{})
	if itemtype == "num" {
		filter["value_type"] = []int{0, 3}
	} else if itemtype == "text" {
		filter["value_type"] = []int{1, 2, 4}
	}

	return ds.ZabbixQuery(ctx, &ZabbixAPIRequest{Method: "item.get", Params: params})
}

func (ds *ZabbixDatasourceInstance) getAllApps(ctx context.Context, hostids []string) (*simplejson.Json, error) {
	params := ZabbixAPIParams{
		"output":  "extend",
		"hostids": hostids,
	}

	return ds.ZabbixQuery(ctx, &ZabbixAPIRequest{Method: "application.get", Params: params})
}

func (ds *ZabbixDatasourceInstance) getAllHosts(ctx context.Context, groupids []string) (*simplejson.Json, error) {
	params := ZabbixAPIParams{
		"output":    []string{"name", "host"},
		"sortfield": "name",
		"groupids":  groupids,
	}

	return ds.ZabbixQuery(ctx, &ZabbixAPIRequest{Method: "host.get", Params: params})
}

func (ds *ZabbixDatasourceInstance) getAllGroups(ctx context.Context) (*simplejson.Json, error) {
	params := ZabbixAPIParams{
		"output":     []string{"name"},
		"sortfield":  "name",
		"real_hosts": true,
	}

	return ds.ZabbixQuery(ctx, &ZabbixAPIRequest{Method: "hostgroup.get", Params: params})
}

func (ds *ZabbixDatasourceInstance) queryNumericDataForItems(ctx context.Context, query *QueryModel, items Items) (*data.Frame, error) {
	valueType := ds.getTrendValueType(query)
	consolidateBy := ds.getConsolidateBy(query)

	if consolidateBy == "" {
		consolidateBy = valueType
	}

	history, err := ds.getHistotyOrTrend(ctx, query, items)
	if err != nil {
		return nil, err
	}

	frame := convertHistory(history, items)
	return frame, nil
}

func (ds *ZabbixDatasourceInstance) getTrendValueType(query *QueryModel) string {
	trendValue := "avg"

	for _, fn := range query.Functions {
		if fn.Def.Name == "trendValue" && len(fn.Params) > 0 {
			trendValue = fn.Params[0]
		}
	}

	return trendValue
}

func (ds *ZabbixDatasourceInstance) getConsolidateBy(query *QueryModel) string {
	consolidateBy := "avg"

	for _, fn := range query.Functions {
		if fn.Def.Name == "consolidateBy" && len(fn.Params) > 0 {
			consolidateBy = fn.Params[0]
		}
	}
	return consolidateBy
}

func (ds *ZabbixDatasourceInstance) getHistotyOrTrend(ctx context.Context, query *QueryModel, items Items) (History, error) {
	timeRange := query.TimeRange
	useTrend := ds.isUseTrend(timeRange)
	allHistory := History{}

	groupedItems := map[int]Items{}

	for _, j := range items {
		groupedItems[j.ValueType] = append(groupedItems[j.ValueType], j)
	}

	for k, l := range groupedItems {
		var itemids []string
		for _, m := range l {
			itemids = append(itemids, m.ID)
		}

		params := ZabbixAPIParams{
			"output":    "extend",
			"sortfield": "clock",
			"sortorder": "ASC",
			"itemids":   itemids,
			"time_from": timeRange.From.Unix(),
			"time_till": timeRange.To.Unix(),
		}

		var response *simplejson.Json
		var err error
		if useTrend {
			response, err = ds.ZabbixQuery(ctx, &ZabbixAPIRequest{Method: "trend.get", Params: params})
		} else {
			params["history"] = &k
			response, err = ds.ZabbixQuery(ctx, &ZabbixAPIRequest{Method: "history.get", Params: params})
		}

		if err != nil {
			return nil, err
		}

		pointJSON, err := response.MarshalJSON()
		if err != nil {
			return nil, fmt.Errorf("Internal error parsing response JSON: %w", err)
		}

		history := History{}
		err = json.Unmarshal(pointJSON, &history)
		if err != nil {
			ds.logger.Error("Error handling history response", "error", err.Error())
		} else {
			allHistory = append(allHistory, history...)
		}
	}
	return allHistory, nil
}

func (ds *ZabbixDatasourceInstance) isUseTrend(timeRange backend.TimeRange) bool {
	if !ds.Settings.Trends {
		return false
	}

	trendsFrom := ds.Settings.TrendsFrom
	trendsRange := ds.Settings.TrendsRange
	fromSec := timeRange.From.Unix()
	toSec := timeRange.To.Unix()
	rangeSec := float64(toSec - fromSec)

	if (fromSec < time.Now().Add(-trendsFrom).Unix()) || (rangeSec > trendsRange.Seconds()) {
		return true
	}
	return false
}

func parseFilter(filter string) (*regexp.Regexp, error) {
	regex := regexp.MustCompile(`^/(.+)/(.*)$`)
	flagRE := regexp.MustCompile("[imsU]+")

	matches := regex.FindStringSubmatch(filter)
	if len(matches) <= 1 {
		return nil, nil
	}

	pattern := ""
	if matches[2] != "" {
		if flagRE.MatchString(matches[2]) {
			pattern += "(?" + matches[2] + ")"
		} else {
			return nil, fmt.Errorf("error parsing regexp: unsupported flags `%s` (expected [imsU])", matches[2])
		}
	}
	pattern += matches[1]

	return regexp.Compile(pattern)
}

func isNotAuthorized(err error) bool {
	if err == nil {
		return false
	}

	message := err.Error()
	return strings.Contains(message, "Session terminated, re-login, please.") ||
		strings.Contains(message, "Not authorised.") ||
		strings.Contains(message, "Not authorized.")
}

func isAppMethodNotFoundError(err error) bool {
	if err == nil {
		return false
	}

	message := err.Error()
	return message == `Method not found. Incorrect API "application".`
}
