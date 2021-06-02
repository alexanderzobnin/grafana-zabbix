package cache

import (
	"time"

	cache "github.com/patrickmn/go-cache"
)

const (
	// For use with functions that take an expiration time.
	NoExpiration time.Duration = -1
	// For use with functions that take an expiration time. Equivalent to
	// passing in the same expiration duration as was given to New() or
	// NewFrom() when the cache was created (e.g. 5 minutes.)
	DefaultExpiration time.Duration = 0
)

// TODO: since all methods moved to datasource_cache, this can be removed and replaced by go-cache

// Cache is a abstraction over go-cache.
type Cache struct {
	cache *cache.Cache
}

// NewCache creates a go-cache with expiration(ttl) time and cleanupInterval.
func NewCache(ttl time.Duration, cleanupInterval time.Duration) *Cache {
	return &Cache{
		cache.New(ttl, cleanupInterval),
	}
}

// Set the value of the key "request" to "rersponse" with default expiration time.
func (c *Cache) Set(request string, response interface{}) {
	c.cache.SetDefault(request, response)
}

// Get the value associated with request from the cache
func (c *Cache) Get(request string) (interface{}, bool) {
	return c.cache.Get(request)
}
