/**
 * This module allows to deduplicate function calls with the same params and
 * cache result of function call.
 */

export class CachingProxy {
  cacheEnabled: boolean;
  ttl: number;
  cache: any;
  promises: any;

  constructor(cacheOptions) {
    this.cacheEnabled = cacheOptions.enabled;
    this.ttl          = cacheOptions.ttl || 600000; // 10 minutes by default

    // Internal objects for data storing
    this.cache = {};
    this.promises = {};
  }

  /**
   * Check that result is present in the cache and is up to date or send request otherwise.
   */
  cacheRequest(func, funcName, funcScope) {
    return cacheRequest(func, funcName, funcScope, this);
  }

  /**
   * Wrap request to prevent multiple calls with same params when request is waiting for response.
   */
  proxify(func, funcName, funcScope) {
    if (!this.promises[funcName]) {
      this.promises[funcName] = {};
    }
    const promiseKeeper = this.promises[funcName];
    return callOnce(func, promiseKeeper, funcScope);
  }

  proxifyWithCache(func, funcName, funcScope) {
    const proxified = this.proxify(func, funcName, funcScope);
    return this.cacheRequest(proxified, funcName, funcScope);
  }

  _isExpired(cacheObject) {
    if (cacheObject) {
      const object_age = Date.now() - cacheObject.timestamp;
      return !(cacheObject.timestamp && object_age < this.ttl);
    } else {
      return true;
    }
  }
}

/**
 * Wrap request to prevent multiple calls
 * with same params when waiting for result.
 */
function callOnce(func, promiseKeeper, funcScope) {
  // tslint:disable-next-line: only-arrow-functions
  return function() {
    const hash = getRequestHash(arguments);
    if (!promiseKeeper[hash]) {
      promiseKeeper[hash] = Promise.resolve(
        func.apply(funcScope, arguments)
        .then(result => {
          promiseKeeper[hash] = null;
          return result;
        }).catch(err => {
          promiseKeeper[hash] = null;
          throw err;
        })
      );
    }
    return promiseKeeper[hash];
  };
}

function cacheRequest(func, funcName, funcScope, self) {
  // tslint:disable-next-line: only-arrow-functions
  return function() {
    if (!self.cache[funcName]) {
      self.cache[funcName] = {};
    }

    const cacheObject = self.cache[funcName];
    const hash = getRequestHash(arguments);
    if (self.cacheEnabled && !self._isExpired(cacheObject[hash])) {
      return Promise.resolve(cacheObject[hash].value);
    } else {
      return func.apply(funcScope, arguments)
      .then(result => {
        if (result !== undefined) {
          cacheObject[hash] = {
            value: result,
            timestamp: Date.now()
          };
        }
        return result;
      });
    }
  };
}

function getRequestHash(args) {
  const argsJson = JSON.stringify(args);
  return getHash(argsJson);
}

function getHash(str: string): number {
  let hash = 0, i, chr, len;
  if (str.length !== 0) {
    for (i = 0, len = str.length; i < len; i++) {
      chr   = str.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
  }
  return hash;
}
