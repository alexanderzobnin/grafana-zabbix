package datasource

import (
	"fmt"
	"strings"
)

type Items []Item

type Item struct {
	ID        string     `json:"itemid,omitempty"`
	Key       string     `json:"key_,omitempty"`
	Name      string     `json:"name,omitempty"`
	ValueType int        `json:"value_type,omitempty,string"`
	HostID    string     `json:"hostid,omitempty"`
	Hosts     []ItemHost `json:"hosts,omitempty"`
	Status    string     `json:"status,omitempty"`
	State     string     `json:"state,omitempty"`
}

func (item *Item) ExpandItem() string {
	name := item.Name
	key := item.Key

	if strings.Index(key, "[") == -1 {
		return name
	}

	keyRunes := []rune(item.Key)
	keyParamsStr := string(keyRunes[strings.Index(key, "[")+1 : strings.LastIndex(key, "]")])
	keyParams := splitKeyParams(keyParamsStr)

	for i := len(keyParams); i >= 1; i-- {
		name = strings.ReplaceAll(name, fmt.Sprintf("$%v", i), keyParams[i-1])
	}

	return name
}

func splitKeyParams(paramStr string) []string {
	paramRunes := []rune(paramStr)
	params := []string{}
	quoted := false
	inArray := false
	splitSymbol := ","
	param := ""

	for _, r := range paramRunes {
		symbol := string(r)
		if symbol == `"` && inArray {
			param += symbol
		} else if symbol == `"` && quoted {
			quoted = false
		} else if symbol == `"` && !quoted {
			quoted = true
		} else if symbol == "[" && !quoted {
			inArray = true
		} else if symbol == "]" && !quoted {
			inArray = false
		} else if symbol == splitSymbol && !quoted && !inArray {
			params = append(params, param)
			param = ""
		} else {
			param += symbol
		}
	}

	params = append(params, param)
	return params
}

type ItemHost struct {
	ID   string `json:"hostid,omitempty"`
	Name string `json:"name,omitempty"`
}

type Trend []TrendPoint

type TrendPoint struct {
	ItemID   string `json:"itemid,omitempty"`
	Clock    int64  `json:"clock,omitempty,string"`
	Num      string `json:"num,omitempty"`
	ValueMin string `json:"value_min,omitempty"`
	ValueAvg string `json:"value_avg,omitempty"`
	ValueMax string `json:"value_max,omitempty"`
}

type History []HistoryPoint

type HistoryPoint struct {
	ItemID string  `json:"itemid,omitempty"`
	Clock  int64   `json:"clock,omitempty,string"`
	Value  float64 `json:"value,omitempty,string"`
	NS     int64   `json:"ns,omitempty,string"`
}
