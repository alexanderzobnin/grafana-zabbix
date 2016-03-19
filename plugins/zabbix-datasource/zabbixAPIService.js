/**
 * General Zabbix API methods
 */

define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('ZabbixAPIService', function($q, backendSrv) {

    /**
     * Request data from Zabbix API
     * @return {object}  response.result
     */
    this.request = function(api_url, method, params, options, auth) {
      var deferred = $q.defer();
      var requestData = {
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: 1
      };

      if (auth === "") {
        // Reject immediately if not authenticated
        deferred.reject({data: "Not authorised."});
        return deferred.promise;
      } else if (auth) {
        // Set auth parameter only if it needed
        requestData.auth = auth;
      }

      var requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        url: api_url,
        data: requestData
      };

      // Set request options for basic auth
      if (options.basicAuth || options.withCredentials) {
        requestOptions.withCredentials = true;
      }
      if (options.basicAuth) {
        requestOptions.headers.Authorization = options.basicAuth;
      }

      backendSrv.datasourceRequest(requestOptions).then(function (response) {
        // General connection issues
        if (!response.data) {
          deferred.reject(response);
        }

        // Handle Zabbix API errors
        else if (response.data.error) {
          deferred.reject(response.data.error);
        }

        deferred.resolve(response.data.result);
      });
      return deferred.promise;
    };

    /**
     * Get authentication token.
     * @return {string}  auth token
     */
    this.login = function(api_url, username, password, options) {
      var params = {
        user: username,
        password: password
      };
      return this.request(api_url, 'user.login', params, options, null);
    };

    /**
     * Get Zabbix API version
     * Matches the version of Zabbix starting from Zabbix 2.0.4
     */
    this.getVersion = function(api_url, options) {
      return this.request(api_url, 'apiinfo.version', [], options);
    };

  });

  // Define zabbix API exception type
  function ZabbixException(error) {
    this.code = error.code;
    this.errorType = error.message;
    this.message = error.data;
  }

  ZabbixException.prototype.toString = function() {
    return this.errorType + ": " + this.message;
  };

});