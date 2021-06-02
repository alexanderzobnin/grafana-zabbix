package datasource

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// ZabbixDatasourceSettingsDTO model
type ZabbixDatasourceSettingsDTO struct {
	Trends      bool   `json:"trends"`
	TrendsFrom  string `json:"trendsFrom"`
	TrendsRange string `json:"trendsRange"`
	CacheTTL    string `json:"cacheTTL"`
	Timeout     string `json:"timeout"`

	DisableReadOnlyUsersAck bool `json:"disableReadOnlyUsersAck"`
}

// ZabbixDatasourceSettings model
type ZabbixDatasourceSettings struct {
	Trends      bool
	TrendsFrom  time.Duration
	TrendsRange time.Duration
	CacheTTL    time.Duration
	Timeout     time.Duration

	DisableReadOnlyUsersAck bool `json:"disableReadOnlyUsersAck"`
}

type ZabbixAPIResourceRequest struct {
	DatasourceId int64                  `json:"datasourceId"`
	Method       string                 `json:"method"`
	Params       map[string]interface{} `json:"params,omitempty"`
}

type ZabbixAPIRequest struct {
	Method string          `json:"method"`
	Params ZabbixAPIParams `json:"params,omitempty"`
}

func (r *ZabbixAPIRequest) String() string {
	jsonRequest, _ := json.Marshal(r.Params)
	return r.Method + string(jsonRequest)
}

type ZabbixAPIParams = map[string]interface{}

type ZabbixAPIResourceResponse struct {
	Result interface{} `json:"result,omitempty"`
}

// QueryModel model
type QueryModel struct {
	Mode        int64           `json:"mode"`
	Group       QueryFilter     `json:"group"`
	Host        QueryFilter     `json:"host"`
	Application QueryFilter     `json:"application"`
	Item        QueryFilter     `json:"item"`
	Functions   []QueryFunction `json:"functions,omitempty"`
	Options     QueryOptions    `json:"options"`

	// Direct from the gRPC interfaces
	TimeRange backend.TimeRange `json:"-"`
}

// QueryOptions model
type QueryFilter struct {
	Filter string `json:"filter"`
}

// QueryOptions model
type QueryOptions struct {
	ShowDisabledItems bool `json:"showDisabledItems"`
}

// QueryOptions model
type QueryFunction struct {
	Def    QueryFunctionDef `json:"def"`
	Params []string         `json:"params"`
	Text   string           `json:"text"`
}

// QueryOptions model
type QueryFunctionDef struct {
	Name     string `json:"name"`
	Category string `json:"category"`
}

// ReadQuery will read and validate Settings from the DataSourceConfg
func ReadQuery(query backend.DataQuery) (QueryModel, error) {
	model := QueryModel{}
	if err := json.Unmarshal(query.JSON, &model); err != nil {
		return model, fmt.Errorf("could not read query: %w", err)
	}

	model.TimeRange = query.TimeRange
	return model, nil
}
