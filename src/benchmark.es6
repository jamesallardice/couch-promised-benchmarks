import Benchmark from 'benchmark';
import async from 'async';
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

  // Whitelist of methods to benchmark. CouchPromised and Qouch share the same
  // method names.
  let methods = [
    'get',
    'fetch',
    'insert',
    'update',
    'view',
  ];

  // Set up the test functions themselves. We configure some default options
  // that are passed into the library constructors.
  let couchPromisedOptions = [
    {
      path: '/test',
    },
  ];

  let qouchOptions = [
    'http://127.0.0.1:5984/test',
  ];

  let tests = {
    'CouchPromised#get': testGet(global.CouchPromised, couchPromisedOptions),
    'Qouch#get': testGet(global.Qouch, qouchOptions),

    'CouchPromised#fetch': testFetch(global.CouchPromised, couchPromisedOptions),
    'Qouch#fetch': testFetch(global.Qouch, qouchOptions),

    'CouchPromised#insert': testInsert(global.CouchPromised, couchPromisedOptions),
    'Qouch#insert': testInsert(global.Qouch, qouchOptions),

    'CouchPromised#update': testUpdate(global.CouchPromised, couchPromisedOptions),
    'Qouch#update': testUpdate(global.Qouch, qouchOptions),

    'CouchPromised#view': testView(global.CouchPromised, couchPromisedOptions),
    'Qouch#view': testView(global.Qouch, qouchOptions),
  };

  // Run tests for each method in series. Running them in parallel will make it
  // hard to output useful information.
  async.eachSeries(methods, ( method, done ) => {

    // Set up a test suite for the next method.
    let suite = new Benchmark.Suite(`#${ method }`);
    console.log(`\nTesting the \'${ method }\' method':`);

    // Add a test for each library, add listeners for the test events and then
    // run the tests.
    suite
    .add(`CouchPromised#${ method }`, tests[ `CouchPromised#${ method }` ], {
      defer: true,
    })
    .add(`Qouch#${ method }`, tests[ `Qouch#${ method }` ], {
      defer: true,
    })
    .on('cycle', ( e ) => console.log(`\t${ e.target.toString() }`))
    .on('complete', function () {

      let fastest = this.filter('fastest');
      let slowest = this.filter('slowest')[ 0 ];

      // If Benchmark determined there was not a significant difference between
      // the performance of the tests it will say more than one test was the
      // "fastest".
      if ( fastest.length > 1 ) {
        return console.log('\n\tNo statistically significant difference.');
      }

      // If Benchmark determined that one test was significantly faster we can
      // work out the percentage increase.
      fastest = fastest[ 0 ];
      let diff = ( ( fastest.hz - slowest.hz ) / slowest.hz ) * 100;
      console.log(`\n\t${ fastest.name } was ${ Math.ceil(diff) }% faster.`);

      done();
    })
    .run();
  });

  //
  // Test functions
  //

  // The 'get' method should return a single document by ID.
  function testGet( Lib, args ) {

    return makeTest(Lib, args, ( couch, nock, deferred ) => {

      nock.get('/test/1')
      .reply(200, { _id: 1, _rev: 1 });

      couch.get('1')
      .then(deferred.resolve.bind(deferred));
    });
  }

  // The 'fetch' method should return an array of documents by ID.
  function testFetch( Lib, args ) {

    return makeTest(Lib, args, ( couch, nock, deferred ) => {

      nock.post('/test/_all_docs?include_docs=true')
      .reply(200, {
        rows: [
          { id: 1, key: 1, doc: { _id: 1, }, },
          { id: 2, key: 2, doc: { _id: 2, }, },
        ],
      });

      couch.fetch([ 1, 2, ])
      .then(deferred.resolve.bind(deferred));
    });
  }

  // The 'insert' method should create a new document and return a subset of
  // its keys.
  function testInsert( Lib, args ) {

    return makeTest(Lib, args, ( couch, nock, deferred ) => {

      nock.post('/test')
      .reply(201, { id: 1, rev: 1, });

      couch.insert({})
      .then(deferred.resolve.bind(deferred));
    });
  }

  // The 'update' method should update an existing document and return a subset
  // of its keys.
  function testUpdate( Lib, args ) {

    return makeTest(Lib, args, ( couch, nock, deferred ) => {

      nock.put('/test/1')
      .reply(201, { id: 1, rev: 2 });

      couch.update({ _id: 1, _rev: 1 })
      .then(deferred.resolve.bind(deferred));
    });
  }

  // The 'view' method should return the rows returned by a view query.
  function testView( Lib, args ) {

    return makeTest(Lib, args, ( couch, nock, deferred ) => {

      nock.get('/test/_design/d/_view/v')
      .reply(200, {
        rows: [ { id: 1, key: [ 2, 3, ], value: null, }, ],
      });

      couch.view('d', 'v')
      .then(deferred.resolve.bind(deferred));
    });
  }

  //
  // Utility functions
  //

  function makeTest( Lib, args, fn ) {

    let couch = new (Lib.bind.apply(Lib, [ null ].concat(args)))();
    let nocked = global.nock('http://127.0.0.1:5984');

    return ( deferred ) => fn(couch, nocked, deferred);
  }
}
