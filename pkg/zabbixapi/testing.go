package zabbixapi

import (
	"bytes"
	"io/ioutil"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

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

func MockZabbixAPI(body string, statusCode int) (*ZabbixAPI, error) {
	apiLogger := log.New()
	zabbixURL, err := url.Parse("http://zabbix.org/zabbix")
	if err != nil {
		return nil, err
	}

	return &ZabbixAPI{
		url:    zabbixURL,
		logger: apiLogger,

		httpClient: NewTestClient(func(req *http.Request) *http.Response {
			return &http.Response{
				StatusCode: statusCode,
				Body:       ioutil.NopCloser(bytes.NewBufferString(body)),
				Header:     make(http.Header),
			}
		}),
	}, nil
}
