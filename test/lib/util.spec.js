var mock = require('mock-fs');
var rewire = require('rewire');

var assert = require('../helper').assert;

var fs = mock.fs();
var util = rewire('../../lib/util');
util.__set__('fs', fs);

describe('util', function() {

  beforeEach(function() {
    fs._reconfigure({
      src: {
        js: {
          'a.js': mock.file({
            mtime: new Date(100)
          }),
          'b.js': mock.file({
            mtime: new Date(200)
          }),
          'c.js': mock.file({
            mtime: new Date(300)
          })
        }
      }
    });
  });

  describe('filterPathsByTime()', function() {

    it('calls callback with files newer than provided time', function(done) {

      var paths = [
        'src/js/a.js',
        'src/js/b.js',
        'src/js/c.js'
      ];

      util.filterPathsByTime(paths, new Date(150), function(err, results) {
        if (err) {
          return done(err);
        }
        assert.equal(results.length, 2);
        assert.deepEqual(results.sort(), ['src/js/b.js', 'src/js/c.js']);
        done();
      });

    });

    it('calls callback error if file not found', function(done) {

      var paths = [
        'src/bogus-file.js'
      ];

      util.filterPathsByTime(paths, new Date(150), function(err, results) {
        assert.instanceOf(err, Error);
        assert.equal(results, undefined);
        done();
      });

    });

  });

  describe('anyNewer()', function() {

    var paths = [
      'src/js/a.js',
      'src/js/b.js',
      'src/js/c.js'
    ];

    it('calls callback with true if any file is newer', function(done) {
      util.anyNewer(paths, new Date(250), function(err, newer) {
        if (err) {
          return done(err);
        }
        assert.isTrue(newer);
        done();
      });
    });

    it('calls callback with false if no files are newer', function(done) {
      util.anyNewer(paths, new Date(350), function(err, newer) {
        if (err) {
          return done(err);
        }
        assert.isFalse(newer);
        done();
      });
    });

    it('calls callback with error if file not found', function(done) {
      util.anyNewer(['bogus/file.js'], new Date(350), function(err, newer) {
        assert.instanceOf(err, Error);
        assert.equal(newer, undefined);
        done();
      });
    });

  });

});
