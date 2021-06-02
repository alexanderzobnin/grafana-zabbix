package timeseries

import (
	"errors"
	"math"
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Aligns point's time stamps according to provided interval.
func (ts TimeSeries) Align(interval time.Duration) TimeSeries {
	if interval <= 0 || ts.Len() < 2 {
		return ts
	}

	alignedTs := NewTimeSeries()
	var frameTs = ts[0].GetTimeFrame(interval)
	var pointFrameTs time.Time
	var point TimePoint

	for i := 1; i < ts.Len(); i++ {
		point = ts[i]
		pointFrameTs = point.GetTimeFrame(interval)

		if pointFrameTs.After(frameTs) {
			for frameTs.Before(pointFrameTs) {
				alignedTs = append(alignedTs, TimePoint{Time: frameTs, Value: nil})
				frameTs = frameTs.Add(interval)
			}
		}

		alignedTs = append(alignedTs, TimePoint{Time: pointFrameTs, Value: point.Value})
		frameTs = frameTs.Add(interval)
	}

	return alignedTs
}

// Detects interval between data points in milliseconds based on median delta between points.
func (ts TimeSeries) DetectInterval() time.Duration {
	if ts.Len() < 2 {
		return 0
	}

	deltas := make([]int, 0)
	for i := 1; i < ts.Len(); i++ {
		delta := ts[i].Time.Sub(ts[i-1].Time)
		deltas = append(deltas, int(delta.Milliseconds()))
	}
	sort.Ints(deltas)
	midIndex := int(math.Floor(float64(len(deltas)) * 0.5))
	return time.Duration(deltas[midIndex]) * time.Millisecond
}

// Gets point timestamp rounded according to provided interval.
func (p *TimePoint) GetTimeFrame(interval time.Duration) time.Time {
	return p.Time.Truncate(interval)
}

func alignDataPoints(frame *data.Frame, interval time.Duration) *data.Frame {
	if interval <= 0 || frame.Rows() < 2 {
		return frame
	}

	timeFieldIdx := getTimeFieldIndex(frame)
	if timeFieldIdx < 0 {
		return frame
	}
	var frameTs = getPointTimeFrame(getTimestampAt(frame, 0), interval)
	var pointFrameTs *time.Time
	var pointsInserted = 0

	for i := 1; i < frame.Rows(); i++ {
		pointFrameTs = getPointTimeFrame(getTimestampAt(frame, i), interval)
		if pointFrameTs == nil || frameTs == nil {
			continue
		}

		if pointFrameTs.After(*frameTs) {
			for frameTs.Before(*pointFrameTs) {
				insertAt := i + pointsInserted
				err := insertNullPointAt(frame, *frameTs, insertAt)
				if err != nil {
					backend.Logger.Debug("Error inserting null point", "error", err)
				}
				*frameTs = frameTs.Add(interval)
				pointsInserted++
			}
		}

		setTimeAt(frame, *pointFrameTs, i+pointsInserted)
		*frameTs = frameTs.Add(interval)
	}

	return frame
}

func getPointTimeFrame(ts *time.Time, interval time.Duration) *time.Time {
	if ts == nil {
		return nil
	}
	timeFrame := ts.Truncate(interval)
	return &timeFrame
}

func getTimeFieldIndex(frame *data.Frame) int {
	for i := 0; i < len(frame.Fields); i++ {
		if frame.Fields[i].Type() == data.FieldTypeTime {
			return i
		}
	}

	return -1
}

func getTimestampAt(frame *data.Frame, index int) *time.Time {
	timeFieldIdx := getTimeFieldIndex(frame)
	if timeFieldIdx < 0 {
		return nil
	}

	tsValue := frame.Fields[timeFieldIdx].At(index)
	ts, ok := tsValue.(time.Time)
	if !ok {
		return nil
	}

	return &ts
}

func insertNullPointAt(frame *data.Frame, frameTs time.Time, index int) error {
	for _, field := range frame.Fields {
		if field.Type() == data.FieldTypeTime {
			field.Insert(index, frameTs)
		} else if field.Type().Nullable() {
			field.Insert(index, nil)
		} else {
			return errors.New("field is not nullable")
		}
	}
	return nil
}

func setTimeAt(frame *data.Frame, frameTs time.Time, index int) {
	for _, field := range frame.Fields {
		if field.Type() == data.FieldTypeTime {
			field.Insert(index, frameTs)
		}
	}
}
