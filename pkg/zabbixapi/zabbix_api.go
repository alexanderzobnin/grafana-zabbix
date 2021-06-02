package zabbixapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/httpclient"
	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"golang.org/x/net/context/ctxhttp"
)

var (
	ErrNotAuthenticated = errors.New("zabbix api: not authenticated")
)

type ZabbixAPI struct {
	url        *url.URL
	httpClient *http.Client
	logger     log.Logger
	auth       string
}

type ZabbixAPIParams = map[string]interface{}

// New returns new ZabbixAPI instance initialized with given URL or error.
func New(dsInfo *backend.DataSourceInstanceSettings, timeout time.Duration) (*ZabbixAPI, error) {
	apiLogger := log.New()
	zabbixURL, err := url.Parse(dsInfo.URL)
	if err != nil {
		return nil, err
	}

	client, err := httpclient.GetHttpClient(dsInfo, timeout)
	if err != nil {
		return nil, err
	}

	return &ZabbixAPI{
		url:        zabbixURL,
		logger:     apiLogger,
		httpClient: client,
	}, nil
}

// GetUrl gets new API URL
func (api *ZabbixAPI) GetUrl() *url.URL {
	return api.url
}

// SetUrl sets new API URL
func (api *ZabbixAPI) SetUrl(api_url string) error {
	zabbixURL, err := url.Parse(api_url)
	if err != nil {
		return err
	}

	api.url = zabbixURL
	return nil
}

// GetAuth returns API authentication token
func (api *ZabbixAPI) GetAuth() string {
	return api.auth
}

// SetAuth sets API authentication token
func (api *ZabbixAPI) SetAuth(auth string) {
	api.auth = auth
}

// Request performs API request
func (api *ZabbixAPI) Request(ctx context.Context, method string, params ZabbixAPIParams) (*simplejson.Json, error) {
	if api.auth == "" {
		return nil, ErrNotAuthenticated
	}

	return api.request(ctx, method, params, api.auth)
}

// Request performs API request without authentication token
func (api *ZabbixAPI) RequestUnauthenticated(ctx context.Context, method string, params ZabbixAPIParams) (*simplejson.Json, error) {
	return api.request(ctx, method, params, "")
}

func (api *ZabbixAPI) request(ctx context.Context, method string, params ZabbixAPIParams, auth string) (*simplejson.Json, error) {
	apiRequest := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  method,
		"params":  params,
	}

	if auth != "" {
		apiRequest["auth"] = auth
	}

	reqBodyJSON, err := json.Marshal(apiRequest)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, api.url.String(), bytes.NewBuffer(reqBodyJSON))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Grafana/grafana-zabbix")

	response, err := makeHTTPRequest(ctx, api.httpClient, req)
	if err != nil {
		return nil, err
	}

	return handleAPIResult(response)
}

// Login performs API authentication and returns authentication token.
func (api *ZabbixAPI) Login(ctx context.Context, username string, password string) (string, error) {
	params := ZabbixAPIParams{
		"user":     username,
		"password": password,
	}

	auth, err := api.request(ctx, "user.login", params, "")
	if err != nil {
		return "", err
	}

	return auth.MustString(), nil
}

// Authenticate performs API authentication and sets authentication token.
func (api *ZabbixAPI) Authenticate(ctx context.Context, username string, password string) error {
	auth, err := api.Login(ctx, username, password)
	if err != nil {
		return err
	}

	api.SetAuth(auth)
	return nil
}

func handleAPIResult(response []byte) (*simplejson.Json, error) {
	jsonResp, err := simplejson.NewJson([]byte(response))
	if err != nil {
		return nil, err
	}
	if errJSON, isError := jsonResp.CheckGet("error"); isError {
		errMessage := fmt.Sprintf("%s %s", errJSON.Get("message").MustString(), errJSON.Get("data").MustString())
		return nil, errors.New(errMessage)
	}
	jsonResult := jsonResp.Get("result")
	return jsonResult, nil
}

func makeHTTPRequest(ctx context.Context, httpClient *http.Client, req *http.Request) ([]byte, error) {
	res, err := ctxhttp.Do(ctx, httpClient, req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("request failed, status: %v", res.Status)
	}

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	return body, nil
}
