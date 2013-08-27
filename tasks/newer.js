var fs = require('fs');
var path = require('path');

function getStamp(dir, name, target) {
  return path.join(dir, name, target, 'timestamp');
}

function createTask(grunt, any) {
  return function(name, target) {
    var options = this.options({
      timestamps: '.grunt'
    });
    var config = grunt.config.get([name, target]);
    var files = grunt.task.normalizeMultiTaskFiles(config, target);
    var newerFiles;
    var stamp = getStamp(options.timestamps, name, target);
    var newer = !grunt.file.exists(stamp);

    if (!newer) {
      // look for files that have been modified since last run
      var previous = fs.statSync(stamp).mtime;
      newerFiles = files.map(function(obj) {
        var src = obj.src.filter(function(filepath) {
          var modified = fs.statSync(filepath).mtime > previous;
          if (modified) {
            newer = true;
          }
          return modified;
        });
        return grunt.util._.defaults({src: src}, obj);
      });
    }

    if (newer) {
      if (!any) {
        // reconfigure task with only the newer files
        config.files = newerFiles;
        delete config.src;
        delete config.dest;
        grunt.config.set([name, target], config);
      }
      // run the task and create timestamp on success
      var qualified = name + ':' + target;
      grunt.task.run([
        qualified,
        'newer-timestamp:' + qualified + ':' + options.timestamps
      ]);
    } else {
      grunt.log.writeln('No newer files to process.');
    }
  }
}


/** @param {Object} grunt Grunt. */
module.exports = function(grunt) {

  grunt.registerTask(
      'newer', 'Run a task with only those source files that have been ' +
      'modified since the last successful run.', createTask(grunt));

  grunt.registerTask(
      'any-newer', 'Run a task with all source files if any have been ' +
      'modified since the last successful run.', createTask(grunt, true));

  grunt.registerTask(
      'newer-timestamp', 'Internal task.', function(name, target, dir) {
        grunt.file.write(getStamp(dir, name, target), '');
      });

};
