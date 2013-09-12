var fs = require('fs');
var path = require('path');

var async = require('async');

function getStampPath(dir, name, target) {
  return path.join(dir, name, target, 'timestamp');
}

var counter = 0;
var configCache = {};

function cacheConfig(config) {
  ++counter;
  configCache[counter] = config;
  return counter;
}

function pluckConfig(id) {
  if (!configCache.hasOwnProperty(id)) {
    throw new Error('Failed to find id in cache');
  }
  var config = configCache[id];
  delete configCache[id];
  return config;
}

function filterSrcByTime(srcFiles, time, callback) {
  async.map(srcFiles, fs.stat, function(err, stats) {
    if (err) {
      return callback(err);
    }
    callback(null, srcFiles.filter(function(filename, index) {
      return stats[index].mtime > time;
    }));
  });
}

function filterFilesByTime(files, previous, callback) {
  async.map(files, function(obj, done) {
    var time;
    /**
     * It is possible that there is a dest file that has been created
     * more recently than the last successful run.  This would happen if
     * a target with multiple dest files failed before all dest files were
     * created.  In this case, we don't need to re-run src files that map
     * to dest files that were already created.
     */
    if (obj.dest) {
      if (fs.existsSync(obj.dest)) {
        time = Math.max(fs.statSync(obj.dest).mtime, previous);
      } else {
        // dest file may have been cleaned
        return done(null, obj);
      }
    } else {
      time = previous;
    }

    filterSrcByTime(obj.src, time, function(err, src) {
      if (err) {
        return done(err);
      }
      done(null, {src: src, dest: obj.dest});
    });

  }, function(err, results) {
    if (err) {
      return callback(err);
    }
    // get rid of file config objects with no src files
    callback(null, results.filter(function(obj) {
      return obj.src && obj.src.length > 0;
    }));
  });
}

function createTask(grunt, any) {
  return function(name, target) {
    var tasks = [];
    var prefix = this.name;
    if (!target) {
      Object.keys(grunt.config(name)).forEach(function(target) {
        if (!/^_|^options$/.test(target)) {
          tasks.push(prefix + ':' + name + ':' + target);
        }
      });
      return grunt.task.run(tasks);
    }
    var args = Array.prototype.slice.call(arguments, 2).join(':');
    var options = this.options({
      timestamps: path.join(__dirname, '..', '.cache')
    });
    var config = grunt.config.get([name, target]);
    var id = cacheConfig(config);
    config = grunt.util._.clone(config);

    /**
     * Special handling for watch task.  This is a multitask that expects
     * the `files` config to be a string or array of string source paths.
     */
    var srcFiles = true;
    if (typeof config.files === 'string') {
      config.src = [config.files];
      delete config.files;
      srcFiles = false;
    } else if (Array.isArray(config.files) &&
        typeof config.files[0] === 'string') {
      config.src = config.files;
      delete config.files;
      srcFiles = false;
    }

    var qualified = name + ':' + target;
    var stamp = getStampPath(options.timestamps, name, target);
    var repeat = grunt.file.exists(stamp);

    if (!repeat) {
      /**
       * This task has never succeeded before.  Process everything.  This is
       * less efficient than it could be for cases where some dest files were
       * created in previous runs that failed, but it makes things easier.
       */
      grunt.task.run([
        qualified + (args ? ':' + args : ''),
        'newer-timestamp:' + qualified + ':' + options.timestamps
      ]);
      return;
    }

    // This task has succeeded before.  Filter src files.

    var done = this.async();

    var previous = fs.statSync(stamp).mtime;
    var files = grunt.task.normalizeMultiTaskFiles(config, target);
    filterFilesByTime(files, previous, function(err, newerFiles) {
      if (err) {
        return done(err);
      } else if (newerFiles.length === 0) {
        grunt.log.writeln('No newer files to process.');
        return done();
      }

      var tasks = [
        qualified + (args ? ':' + args : ''),
        'newer-timestamp:' + qualified + ':' + options.timestamps
      ];

      if (!any) {
        /**
         * If we started out with only src files in the files config,
         * transform the newerFiles array into an array of source files.
         */
        if (!srcFiles) {
          newerFiles = newerFiles.map(function(obj) {
            return obj.src;
          });
        }

        // configure target with only newer files
        config.files = newerFiles;
        delete config.src;
        delete config.dest;
        grunt.config.set([name, target], config);
        tasks.push('newer-reconfigure:' + qualified + ':' + id);
      }

      // run the task, track the time, and (potentially) reconfigure
      grunt.task.run(tasks);

      done();
    });

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
        grunt.file.write(getStampPath(dir, name, target), '');
      });

  grunt.registerTask(
      'newer-reconfigure', 'Internal task.', function(name, target, id) {
        grunt.config.set([name, target], pluckConfig(id));
      });

};
