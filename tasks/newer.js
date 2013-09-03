var fs = require('fs');
var path = require('path');

function getStamp(dir, name, target) {
  return path.join(dir, name, target, 'timestamp');
}

function createTask(grunt, any) {
  return function(name, target) {
    var args = Array.prototype.slice.call(arguments, 2).join(':');
    var options = this.options({
      timestamps: '.grunt'
    });
    var config = grunt.config.get([name, target]);
    var files = grunt.task.normalizeMultiTaskFiles(config, target);
    var newerFiles;
    var stamp = getStamp(options.timestamps, name, target);
    var repeat = grunt.file.exists(stamp);
    var modified = false;

    if (repeat) {
      // look for files that have been modified since last run
      var previous = fs.statSync(stamp).mtime;
      newerFiles = files.map(function(obj) {
        var src = obj.src.filter(function(filepath) {
          var newer = fs.statSync(filepath).mtime > previous;
          if (newer) {
            modified = true;
          }
          return newer;
        });
        return grunt.util._.defaults({src: src}, obj);
      });
    }

    /**
     * Cases:
     *
     * 1) First run, process all.
     * 2) Repeat run, nothing modified, process none.
     * 3) Repeat run, something modified, any false, process modified.
     * 4) Repeat run, something modified, any true, process all.
     */

    var qualified = name + ':' + target;
    if (repeat && !modified) {
      // case 2
      grunt.log.writeln('No newer files to process.');
    } else {
      if (repeat && modified && !any) {
        // case 3
        config.files = newerFiles;
        delete config.src;
        delete config.dest;
        grunt.config.set([name, target], config);
      }
      // case 1, 4, or 3
      grunt.task.run([
        qualified + (args ? ':' + args : ''),
        'newer-timestamp:' + qualified + ':' + options.timestamps
      ]);
    }
  };
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
        // if dir includes a ':', grunt will split it among multiple args
        dir = Array.prototype.slice.call(arguments, 2).join(':');
        grunt.file.write(getStamp(dir, name, target), '');
      });

};
