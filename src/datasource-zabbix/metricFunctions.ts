import _ from 'lodash';
import { isNumeric } from './utils';

const index = [];
const categories = {
  Transform: [],
  Aggregate: [],
  Filter: [],
  Trends: [],
  Time: [],
  Alias: [],
  Special: []
};

function addFuncDef(funcDef) {
  funcDef.params = funcDef.params || [];
  funcDef.defaultParams = funcDef.defaultParams || [];

  if (funcDef.category) {
    categories[funcDef.category].push(funcDef);
  }
  index[funcDef.name] = funcDef;
  index[funcDef.shortName || funcDef.name] = funcDef;
}

// Transform

addFuncDef({
  name: 'groupBy',
  category: 'Transform',
  params: [
    { name: 'interval', type: 'string'},
    { name: 'function', type: 'string', options: ['avg', 'min', 'max', 'sum', 'count', 'median'] }
  ],
  defaultParams: ['1m', 'avg'],
});

addFuncDef({
  name: 'scale',
  category: 'Transform',
  params: [
    { name: 'factor', type: 'float', options: [100, 0.01, 10, -1]}
  ],
  defaultParams: [100],
});

addFuncDef({
  name: 'offset',
  category: 'Transform',
  params: [
    { name: 'delta', type: 'float', options: [-100, 100]}
  ],
  defaultParams: [100],
});

addFuncDef({
  name: 'delta',
  category: 'Transform',
  params: [],
  defaultParams: [],
});

addFuncDef({
  name: 'rate',
  category: 'Transform',
  params: [],
  defaultParams: [],
});

addFuncDef({
  name: 'movingAverage',
  category: 'Transform',
  params: [
    { name: 'factor', type: 'int', options: [6, 10, 60, 100, 600] }
  ],
  defaultParams: [10],
});

addFuncDef({
  name: 'exponentialMovingAverage',
  category: 'Transform',
  params: [
    { name: 'smoothing', type: 'float', options: [6, 10, 60, 100, 600] }
  ],
  defaultParams: [0.2],
});

addFuncDef({
  name: 'percentile',
  category: 'Transform',
  params: [
    { name: 'interval', type: 'string' },
    { name: 'percent', type: 'float', options: [25, 50, 75, 90, 95, 99, 99.9] }
  ],
  defaultParams: ['1m', 95],
});

addFuncDef({
  name: 'removeAboveValue',
  category: 'Transform',
  params: [
    {name: 'number', type: 'float'},
  ],
  defaultParams: [0],
});

addFuncDef({
  name: 'removeBelowValue',
  category: 'Transform',
  params: [
    {name: 'number', type: 'float'},
  ],
  defaultParams: [0],
});

addFuncDef({
  name: 'transformNull',
  category: 'Transform',
  params: [
    {name: 'number', type: 'float'}
  ],
  defaultParams: [0],
});

// Aggregate

addFuncDef({
  name: 'sumSeries',
  category: 'Aggregate',
  params: [],
  defaultParams: [],
});

addFuncDef({
  name: 'median',
  category: 'Aggregate',
  params: [
    { name: 'interval', type: 'string'}
  ],
  defaultParams: ['1m'],
});

addFuncDef({
  name: 'average',
  category: 'Aggregate',
  params: [
    { name: 'interval', type: 'string' }
  ],
  defaultParams: ['1m'],
});

addFuncDef({
  name: 'percentileAgg',
  category: 'Aggregate',
  params: [
    { name: 'interval', type: 'string' },
    { name: 'percent', type: 'float', options: [25, 50, 75, 90, 95, 99, 99.9] }
  ],
  defaultParams: ['1m', 95],
});

addFuncDef({
  name: 'min',
  category: 'Aggregate',
  params: [
    { name: 'interval', type: 'string' }
  ],
  defaultParams: ['1m'],
});

addFuncDef({
  name: 'max',
  category: 'Aggregate',
  params: [
    { name: 'interval', type: 'string' }
  ],
  defaultParams: ['1m'],
});

addFuncDef({
  name: 'sum',
  category: 'Aggregate',
  params: [
    { name: 'interval', type: 'string' }
  ],
  defaultParams: ['1m'],
});

addFuncDef({
  name: 'count',
  category: 'Aggregate',
  params: [
    { name: 'interval', type: 'string' }
  ],
  defaultParams: ['1m'],
});

addFuncDef({
  name: 'aggregateBy',
  category: 'Aggregate',
  params: [
    { name: 'interval', type: 'string' },
    { name: 'function', type: 'string', options: ['avg', 'min', 'max', 'sum', 'count', 'median'] }
  ],
  defaultParams: ['1m', 'avg'],
});

// Filter

addFuncDef({
  name: 'top',
  category: 'Filter',
  params: [
    { name: 'number', type: 'int' },
    { name: 'value', type: 'string', options: ['avg', 'min', 'max', 'sum', 'count', 'median'] }
  ],
  defaultParams: [5, 'avg'],
});

addFuncDef({
  name: 'bottom',
  category: 'Filter',
  params: [
    { name: 'number', type: 'int' },
    { name: 'value', type: 'string', options: ['avg', 'min', 'max', 'sum', 'count', 'median'] }
  ],
  defaultParams: [5, 'avg'],
});

addFuncDef({
  name: 'sortSeries',
  category: 'Filter',
  params: [
    { name: 'direction', type: 'string', options: ['asc', 'desc'] }
  ],
  defaultParams: ['asc']
});

// Trends

addFuncDef({
  name: 'trendValue',
  category: 'Trends',
  params: [
    { name: 'type', type: 'string', options: ['avg', 'min', 'max', 'sum', 'count'] }
  ],
  defaultParams: ['avg'],
});

// Time

addFuncDef({
  name: 'timeShift',
  category: 'Time',
  params: [
    { name: 'interval', type: 'string', options: ['24h', '7d', '1M', '+24h', '-24h']}
  ],
  defaultParams: ['24h'],
});

//Alias

addFuncDef({
  name: 'setAlias',
  category: 'Alias',
  params: [
    { name: 'alias', type: 'string' }
  ],
  defaultParams: []
});

addFuncDef({
  name: 'setAliasByRegex',
  category: 'Alias',
  params: [
    { name: 'aliasByRegex', type: 'string' }
  ],
  defaultParams: []
});

addFuncDef({
  name: 'replaceAlias',
  category: 'Alias',
  params: [
    { name: 'regexp', type: 'string' },
    { name: 'newAlias', type: 'string' }
  ],
  defaultParams: ['/(.*)/', '$1']
});

// Special
addFuncDef({
  name: 'consolidateBy',
  category: 'Special',
  params: [
    { name: 'type', type: 'string', options: ['avg', 'min', 'max', 'sum', 'count'] }
  ],
  defaultParams: ['avg'],
});

_.each(categories, (funcList, catName) => {
  categories[catName] = _.sortBy(funcList, 'name');
});

class FuncInstance {
  def: any;
  params: any;
  text: string;
  added: boolean;

  constructor(funcDef, params) {
    this.def = funcDef;

    if (params) {
      this.params = params;
    } else {
      // Create with default params
      this.params = [];
      this.params = funcDef.defaultParams.slice(0);
    }

    this.updateText();
  }

  bindFunction(metricFunctions) {
    const func = metricFunctions[this.def.name];
    if (func) {

      // Bind function arguments
      let bindedFunc = func;
      let param;
      for (let i = 0; i < this.params.length; i++) {
        param = this.params[i];

        // Convert numeric params
        if (this.def.params[i].type === 'int' ||
            this.def.params[i].type === 'float') {
          param = Number(param);
        }
        bindedFunc = _.partial(bindedFunc, param);
      }
      return bindedFunc;
    } else {
      throw { message: 'Method not found ' + this.def.name };
    }
  }

  render(metricExp) {
    const str = this.def.name + '(';
    const parameters = _.map(this.params, (value, index) => {
      const paramType = this.def.params[index].type;
      if (paramType === 'int' ||
          paramType === 'float' ||
          paramType === 'value_or_series' ||
          paramType === 'boolean') {
        return value;
      } else if (paramType === 'int_or_interval' && isNumeric(value)) {
        return value;
      }

      return "'" + value + "'";

    });

    if (metricExp) {
      parameters.unshift(metricExp);
    }

    return str + parameters.join(', ') + ')';
  }

  _hasMultipleParamsInString(strValue, index) {
    if (strValue.indexOf(',') === -1) {
      return false;
    }

    return this.def.params[index + 1] && this.def.params[index + 1].optional;
  }

  updateParam(strValue, index) {
    // handle optional parameters
    // if string contains ',' and next param is optional, split and update both
    if (this._hasMultipleParamsInString(strValue, index)) {
      _.each(strValue.split(','), (partVal, idx) => {
        this.updateParam(partVal.trim(), idx);
      });
      return;
    }

    if (strValue === '' && this.def.params[index].optional) {
      this.params.splice(index, 1);
    }else {
      this.params[index] = strValue;
    }

    this.updateText();
  }

  updateText() {
    if (this.params.length === 0) {
      this.text = this.def.name + '()';
      return;
    }

    let text = this.def.name + '(';
    text += this.params.join(', ');
    text += ')';
    this.text = text;
  }
}

export function createFuncInstance(funcDef, params?) {
  if (_.isString(funcDef)) {
    if (!index[funcDef]) {
      throw { message: 'Method not found ' + name };
    }
    funcDef = index[funcDef];
  }
  return new FuncInstance(funcDef, params);
}

export function getFuncDef(name) {
  return index[name];
}

export function getCategories() {
  return categories;
}
