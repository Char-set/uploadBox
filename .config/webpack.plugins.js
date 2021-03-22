const webpack = require('webpack')
const config = require('./config.base')

module.exports = [
  new webpack.DefinePlugin({
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'process.env._APP_apiHost':`"${config.apiHost}"`
  }),
];
