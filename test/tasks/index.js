var assert = require('assert');
var fs = require('fs');


/**
 * Create a clone of the object without the with just src and dest properties.
 * @param {Object} obj Source object.
 * @return {Object} Pruned clone.
 */
function prune(obj) {
  return {
    src: obj.src,
    dest: obj.dest
  };
}


/** @param {Object} grunt Grunt. */
module.exports = function(grunt) {

  grunt.registerMultiTask('assert', function(name, target) {
    var config = grunt.config([name, target]);
    var expected = grunt.task.normalizeMultiTaskFiles(config, target)
        .map(prune);
    var log = this.data.getLog();

    if (expected.length === 0 || expected[0].src.length === 0) {
      assert.equal(log.length, 0, 'No log entries');
    } else {
      assert.equal(log.length, 1, 'One log entry');
      var actual = log[0].map(prune);
      assert.deepEqual(actual, expected);
      log.length = 0;
    }

  });


  grunt.registerMultiTask('log', function() {
    var log = this.data.getLog();
    log.push(this.files.map(prune));
  });


  grunt.registerTask('wait', function(delay) {
    setTimeout(this.async(), delay);
  });


  grunt.registerMultiTask('modified', function() {
    this.filesSrc.forEach(function(filepath) {
      var now = new Date();
      fs.utimesSync(filepath, now, now);
      grunt.verbose.writeln('Updating mtime for file: ' + filepath, now);
    });
  });

};
