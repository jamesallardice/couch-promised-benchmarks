import Benchmark from 'benchmark';
import nock from 'nock';

// Import libs to benchmark
import CouchPromised from 'couch-promised';
import Qouch from 'qouch';

export default function benchmark() {

  // Expose required libs on the global object. This is necessary because
  // Benchmark attempts to reconstruct test functions and breaks scope. By
  // exposing these on the global object we can refer to them directly within
  // test functions. See https://github.com/bestiejs/benchmark.js/issues/51.
  global.CouchPromised = CouchPromised;
  global.Qouch = Qouch;
  global.nock = nock;

  // Set up the test suite.
  let suite = new Benchmark.Suite();

  suite
  .add('CouchPromised', testCouchPromised, {
    defer: true,
  })
  .add('Qouch', testQouch, {
    defer: true,
  })
  .on('cycle', ( e ) => console.log(e.target.toString()))
  .on('complete', function () {

    let fastest = this.filter('fastest');
    let slowest = this.filter('slowest')[ 0 ];

    // If Benchmark determined there was not a significant difference between
    // the performance of the tests it will say more than one test was the
    // "fastest".
    if ( fastest.length > 1 ) {
      return console.log('No statistically significant difference.');
    }

    // If Benchmark determined that one test was significantly faster we can
    // work out the percentage increase.
    fastest = fastest[ 0 ];
    let diff = ( ( fastest.hz - slowest.hz ) / slowest.hz ) * 100;
    console.log(`${ fastest.name } was ${ Math.ceil(diff) }% faster.`);
  })
  .run();

  // Set up the test functions themselves.
  function testCouchPromised( deferred ) {

    let couch = new global.CouchPromised({
      path: '/test',
    });

    global.nock('http://127.0.0.1:5984')
    .get('/test/1')
    .reply(200, { _id: 1, _rev: 1 });

    couch.get('1')
    .then(deferred.resolve.bind(deferred));
  }

  function testQouch( deferred ) {

    let qouch = new global.Qouch('http://127.0.0.1:5984/test');

    global.nock('http://127.0.0.1:5984')
    .get('/test/1')
    .reply(200, { _id: 1, _rev: 1 });

    qouch.get('1')
    .then(deferred.resolve.bind(deferred));
  }
}
