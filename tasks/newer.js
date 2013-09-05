var fs = require('fs');
var path = require('path');

function getStamp(dir, name, target) {
  return path.join(dir, name, target, 'timestamp');
}

function createTask(grunt, any) {
  return function(name, target) {
    if (!target) {
      var tasks = [];
      Object.keys(grunt.config(name)).forEach(function(target) {
        if (!/^_|^options$/.test(target)) {
          tasks.push('newer:' + name + ':' + target);
        }
      });
      return grunt.task.run(tasks);
    }
    var args = Array.prototype.slice.call(arguments, 2).join(':');
    var options = this.options({
      timestamps: path.join(__dirname, '..', '.cache')
    });
    var config = grunt.config.get([name, target]);
    /**
     * Special handling for watch task.  This is a multitask that expects
     * the `files` config to be a string or array of string source paths.
     */
    var srcFiles = true;
    if (typeof config.files === 'string') {
      config.src = [config.files];
      delete config.files;
      srcFiles = true;
    } else if (Array.isArray(config.files) &&
        typeof config.files[0] === 'string') {
      config.src = config.files;
      delete config.files;
      srcFiles = true;
    }
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
     * If we started out with only src files in the files config, transform
     * the newerFiles array into an array of source files.
     */
    if (!srcFiles) {
      newerFiles = newerFiles.map(function(obj) {
        return obj.src;
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
