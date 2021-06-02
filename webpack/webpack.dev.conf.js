const baseWebpackConfig = require('./webpack.base.conf');

var conf = baseWebpackConfig;
// conf.watch = true;
conf.mode = 'development';
conf.devtool = 'source-map';

module.exports = baseWebpackConfig;
