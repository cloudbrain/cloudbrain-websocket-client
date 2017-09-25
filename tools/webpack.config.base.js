module.exports = {
  module: {
    loaders: [{
      test: /\.js$/,
      exclude: /(bower_components|node_modules)/,
      loader: 'babel',
    }],
  },
  output: {
    libraryTarget: 'umd',
    library: 'cloudbrain-websocket-client',
  },
  resolve: {
    extensions: [
      '',
      '.js',
    ],
  },
};
