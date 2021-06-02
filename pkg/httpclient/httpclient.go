package httpclient

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

type proxyTransportCache struct {
	cache map[int64]cachedTransport
	sync.Mutex
}

// dataSourceTransport implements http.RoundTripper (https://golang.org/pkg/net/http/#RoundTripper)
type dataSourceTransport struct {
	headers   map[string]string
	transport *http.Transport
}

// RoundTrip executes a single HTTP transaction, returning a Response for the provided Request.
func (d *dataSourceTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	for key, value := range d.headers {
		req.Header.Set(key, value)
	}

	return d.transport.RoundTrip(req)
}

type cachedTransport struct {
	updated time.Time

	*dataSourceTransport
}

var ptc = proxyTransportCache{
	cache: make(map[int64]cachedTransport),
}

// GetHttpClient returns new http.Client. Transport either initialized or got from cache.
func GetHttpClient(ds *backend.DataSourceInstanceSettings, timeout time.Duration) (*http.Client, error) {
	transport, err := getHttpTransport(ds)
	if err != nil {
		return nil, err
	}

	log.DefaultLogger.Debug("Initializing new HTTP client", "timeout", timeout.Seconds())

	return &http.Client{
		Timeout:   timeout,
		Transport: transport,
	}, nil
}

func getHttpTransport(ds *backend.DataSourceInstanceSettings) (*dataSourceTransport, error) {
	ptc.Lock()
	defer ptc.Unlock()

	if t, present := ptc.cache[ds.ID]; present && ds.Updated.Equal(t.updated) {
		return t.dataSourceTransport, nil
	}

	tlsConfig, err := getTLSConfig(ds)
	if err != nil {
		return nil, err
	}

	tlsConfig.Renegotiation = tls.RenegotiateFreelyAsClient

	// Create transport which adds all
	customHeaders := getCustomHeaders(ds)
	transport := &http.Transport{
		TLSClientConfig: tlsConfig,
		Proxy:           http.ProxyFromEnvironment,
		Dial: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).Dial,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
	}

	if ds.BasicAuthEnabled {
		user := ds.BasicAuthUser
		password := ds.DecryptedSecureJSONData["basicAuthPassword"]
		basicAuthHeader := getBasicAuthHeader(user, password)
		customHeaders["Authorization"] = basicAuthHeader
	}

	dsTransport := &dataSourceTransport{
		headers:   customHeaders,
		transport: transport,
	}

	ptc.cache[ds.ID] = cachedTransport{
		dataSourceTransport: dsTransport,
		updated:             ds.Updated,
	}

	return dsTransport, nil
}

func getTLSConfig(ds *backend.DataSourceInstanceSettings) (*tls.Config, error) {
	var tlsSkipVerify, tlsClientAuth, tlsAuthWithCACert bool
	jsonData, err := simplejson.NewJson(ds.JSONData)
	if err != nil {
		return nil, err
	}

	if jsonData != nil {
		tlsClientAuth = jsonData.Get("tlsAuth").MustBool(false)
		tlsAuthWithCACert = jsonData.Get("tlsAuthWithCACert").MustBool(false)
		tlsSkipVerify = jsonData.Get("tlsSkipVerify").MustBool(false)
	}

	tlsConfig := &tls.Config{
		InsecureSkipVerify: tlsSkipVerify,
	}

	if tlsClientAuth || tlsAuthWithCACert {
		decrypted := ds.DecryptedSecureJSONData
		if tlsAuthWithCACert && len(decrypted["tlsCACert"]) > 0 {
			caPool := x509.NewCertPool()
			ok := caPool.AppendCertsFromPEM([]byte(decrypted["tlsCACert"]))
			if !ok {
				return nil, errors.New("Failed to parse TLS CA PEM certificate")
			}
			tlsConfig.RootCAs = caPool
		}

		if tlsClientAuth {
			cert, err := tls.X509KeyPair([]byte(decrypted["tlsClientCert"]), []byte(decrypted["tlsClientKey"]))
			if err != nil {
				return nil, err
			}
			tlsConfig.Certificates = []tls.Certificate{cert}
		}
	}

	return tlsConfig, nil
}

// getCustomHeaders returns a map with all the to be set headers
// The map key represents the HeaderName and the value represents this header's value
func getCustomHeaders(ds *backend.DataSourceInstanceSettings) map[string]string {
	headers := make(map[string]string)
	jsonData, err := simplejson.NewJson(ds.JSONData)
	if jsonData == nil || err != nil {
		return headers
	}

	decrypted := ds.DecryptedSecureJSONData
	index := 1
	for {
		headerNameSuffix := fmt.Sprintf("httpHeaderName%d", index)
		headerValueSuffix := fmt.Sprintf("httpHeaderValue%d", index)

		key := jsonData.Get(headerNameSuffix).MustString()
		if key == "" {
			// No (more) header values are available
			break
		}

		if val, ok := decrypted[headerValueSuffix]; ok {
			headers[key] = val
		}
		index++
	}

	return headers
}

// getBasicAuthHeader returns a base64 encoded string from user and password.
func getBasicAuthHeader(user string, password string) string {
	var userAndPass = user + ":" + password
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(userAndPass))
}
