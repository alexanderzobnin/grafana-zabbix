package zabbixapi

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestZabbixAPIUnauthenticatedQuery(t *testing.T) {
	zabbixApi, _ := MockZabbixAPI(`{"result":"sampleResult"}`, 200)
	resp, err := zabbixApi.RequestUnauthenticated(context.Background(), "test.get", map[string]interface{}{})

	assert.Equal(t, "sampleResult", resp.MustString())
	assert.Nil(t, err)
}

func TestLogin(t *testing.T) {
	zabbixApi, _ := MockZabbixAPI(`{"result":"secretauth"}`, 200)
	err := zabbixApi.Authenticate(context.Background(), "user", "password")

	assert.Nil(t, err)
	assert.Equal(t, "secretauth", zabbixApi.auth)
}

func TestZabbixAPI(t *testing.T) {
	tests := []struct {
		name                string
		auth                string
		mockApiResponse     string
		mockApiResponseCode int
		expectedResult      string
		expectedError       error
	}{
		{
			name:                "Simple request",
			auth:                "secretauth",
			mockApiResponse:     `{"result":"sampleResult"}`,
			mockApiResponseCode: 200,
			expectedResult:      "sampleResult",
			expectedError:       nil,
		},
		{
			name:                "Request should return error if API not authenticated",
			auth:                "",
			mockApiResponse:     `{"result":"sampleResult"}`,
			mockApiResponseCode: 200,
			expectedResult:      "",
			expectedError:       ErrNotAuthenticated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			zabbixApi, _ := MockZabbixAPI(tt.mockApiResponse, tt.mockApiResponseCode)
			zabbixApi.auth = tt.auth
			resp, err := zabbixApi.Request(context.Background(), "test.get", map[string]interface{}{})

			if tt.expectedError != nil {
				assert.Equal(t, err, tt.expectedError)
			} else {
				assert.NotNil(t, resp)
				// assert.Equal(t, tt.expectedResult, resp.MustString())
				assert.Nil(t, err)
			}
		})
	}
}
