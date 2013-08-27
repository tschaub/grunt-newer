var fs = require('fs');
var path = require('path');

function getStamp(name, target) {
  return path.join('.grunt', name, target, 'timestamp');
}


/** @param {Object} grunt Grunt. */
module.exports = function(grunt) {

  var newerInfo = 'Run a task with only those source files that have been ' +
      'modified since the last successful run.';
  grunt.registerTask('newer', newerInfo, function() {

    var name = Array.prototype.shift.call(arguments);
    var target = Array.prototype.shift.call(arguments) || '*';
    var data = grunt.config.get([name, target]);

    var files = grunt.task.normalizeMultiTaskFiles(data, target);
    var stamp = getStamp(name, target);
    var some = false;
    if (grunt.file.exists(stamp)) {
      var previous = fs.statSync(stamp).mtime;
      files = files.map(function(obj) {
        var src = obj.src.filter(function(filepath) {
          var newer = fs.statSync(filepath).mtime > previous;
          if (newer) {
            some = true;
          }
          return newer;
        });
        return {src: src};
      });
    }

    if (some) {
      var config = grunt.config.get([name, target]);
      config.files = files;
      delete config.src;
      delete config.dest;
      grunt.config.set([name, target], config);

      var qualified = name + ':' + target;
      grunt.task.run([
        qualified,
        'newer-timestamp:' + qualified
      ]);
    } else {
      grunt.log.writeln('No newer files to process.');
    }

  });

  var tsInfo = 'Internal task that is run after successful task runs.';
  grunt.registerTask('newer-timestamp', tsInfo, function(name, target) {
    grunt.file.write(getStamp(name, target), '');
  });

};
