// Hook Babel into Node's require system to transpile ES6 on-the-fly.
require('babel/register')({
  extensions: [
    '.es6',
  ],
});

// Run the benchmark tests.
require('./src/benchmark')();
