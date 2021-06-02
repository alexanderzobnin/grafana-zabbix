package timeseries

import "time"

type TimePoint struct {
	Time  time.Time
	Value *float64
}

type TimeSeries []TimePoint

func NewTimeSeries() TimeSeries {
	return make(TimeSeries, 0)
}

func (ts *TimeSeries) Len() int {
	return len(*ts)
}
