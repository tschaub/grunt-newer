var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var async = require('async');


/**
 * Call the callback with `false` in the next tick.
 * @param {string} src Source file path.
 * @param {number} time Comparison time.
 * @param {function(boolean)} callback Called with `false`.
 */
function neverNewer(src, time, callback) {
  process.nextTick(function() {
    callback(false);
  });
}


/**
 * Filter a list of files by mtime.
 * @param {Array.<string>} paths List of file paths.
 * @param {Date} time The comparison time.
 * @param {function(Err, Array.<string>)} callback Callback called with any
 *     error and a list of files that have mtimes newer than the provided time.
 * @param {function(boolean)} isNewer Optional function to determine if a file
 *     should be considered newer even if the mtime is not newer.
 */
var filterPathsByTime = exports.filterPathsByTime = function(paths, time,
    callback, isNewer) {
  isNewer = isNewer || neverNewer;
  async.filter(paths, function(filepath, include) {
    fs.stat(filepath, function(err, stats) {
      if (err) {
        return callback(err);
      }
      if (stats.mtime > time) {
        return include(true);
      }
      isNewer(filepath, time, include);
    });
  }, function(results) {
    callback(null, results);
  });
};


/**
 * Determine if any of the given files are newer than the provided time.
 * @param {Array.<string>} paths List of file paths.
 * @param {Date} time The comparison time.
 * @param {function(Err, boolean)} callback Callback called with any error and
 *     a boolean indicating whether any one of the supplied files is newer than
 *     the comparison time.
 * @param {function(boolean)} isNewer Optional function to determine if a file
 *     should be considered newer even if the mtime is not newer.
 */
var anyNewer = exports.anyNewer = function(paths, time, callback, isNewer) {
  var complete = 0;
  isNewer = isNewer || neverNewer;
  function iterate() {
    fs.stat(paths[complete], function(err, stats) {
      if (err) {
        return callback(err);
      }
      if (stats.mtime > time) {
        return callback(null, true);
      }
      // one last check to decide whether the file is newer
      isNewer(paths[complete], time, function(newer) {
        if (newer) {
          return callback(null, true);
        }
        ++complete;
        if (complete >= paths.length) {
          return callback(null, false);
        }
        iterate();
      });
    });
  }
  iterate();
};


/**
 * Filter a list of file config objects by time.  Source files on the provided
 * objects are removed if they have not been modified since the provided time
 * or any dest file mtime for a dest file on the same object.
 * @param {Array.<Object>} files A list of Grunt file config objects.  These
 *     are returned from `grunt.task.normalizeMultiTaskFiles` and have a src
 *     property (Array.<string>) and an optional dest property (string).
 * @param {Date} previous Comparison time.
 * @param {function(Error, Array.<Object>)} callback Callback called with
 *     modified file config objects.  Objects with no more src files are
 *     filtered from the results.
 * @param {function(boolean)} isNewer Optional function to determine if a file
 *     should be considered newer even if the mtime is not newer.
 */
var filterFilesByTime = exports.filterFilesByTime = function(files, previous,
    callback, isNewer) {
  async.map(files, function(obj, done) {
    if (obj.dest) {
      fs.stat(obj.dest, function(err, stats) {
        if (err) {
          // dest file not yet created, use all src files
          return done(null, obj);
        }
        return anyNewer(obj.src, stats.mtime, function(err, any) {
          done(err, any && obj);
        }, isNewer);
      });
    } else {
      filterPathsByTime(obj.src, previous, function(err, src) {
        if (err) {
          return done(err);
        }
        done(null, {src: src, dest: obj.dest});
      }, isNewer);
    }
  }, function(err, results) {
    if (err) {
      return callback(err);
    }
    // get rid of file config objects with no src files
    callback(null, results.filter(function(obj) {
      return obj && obj.src && obj.src.length > 0;
    }));
  });
};


/**
 * Get path to cached file hash for a target.
 * @param {string} cacheDir Path to cache dir.
 * @param {string} taskName Task name.
 * @param {string} targetName Target name.
 * @param {string} filePath Path to file.
 * @return {string} Path to hash.
 */
var getHashPath = exports.getHashPath = function(cacheDir, taskName, targetName,
    filePath) {
  var hashedName = crypto.createHash('md5').update(filePath).digest('hex');
  return path.join(cacheDir, taskName, targetName, 'hashes', hashedName);
};


/**
 * Get an existing hash for a file (if it exists).
 * @param {string} filePath Path to file.
 * @param {string} cacheDir Cache directory.
 * @param {string} taskName Task name.
 * @param {string} targetName Target name.
 * @param {function(Error, string} callback Callback called with an error and
 *     file hash (or null if the file doesn't exist).
 */
var getExistingHash = exports.getExistingHash = function(filePath, cacheDir,
    taskName, targetName, callback) {
  var hashPath = getHashPath(cacheDir, taskName, targetName, filePath);
  fs.exists(hashPath, function(exists) {
    if (!exists) {
      return callback(null, null);
    }
    fs.readFile(hashPath, callback);
  });
};


/**
 * Generate a hash (md5sum) of a file contents.
 * @param {string} filePath Path to file.
 * @param {function(Error, string)} callback Callback called with any error and
 *     the hash of the file contents.
 */
var generateFileHash = exports.generateFileHash = function(filePath, callback) {
  var md5sum = crypto.createHash('md5');
  var stream = new fs.ReadStream(filePath);
  stream.on('data', function(chunk) {
    md5sum.update(chunk);
  });
  stream.on('error', callback);
  stream.on('end', function() {
    callback(null, md5sum.digest('hex'));
  });
};


/**
 * Filter files based on hashed contents.
 * @param {Array.<string>} paths List of paths to files.
 * @param {string} cacheDir Cache directory.
 * @param {string} taskName Task name.
 * @param {string} targetName Target name.
 * @param {function(Error, Array.<string>)} callback Callback called with any
 *     error and a filtered list of files that only includes files with hashes
 *     that are different than the cached hashes for the same files.
 */
var filterPathsByHash = exports.filterPathsByHash = function(paths, cacheDir,
    taskName, targetName, callback) {
  async.filter(paths, function(filePath, done) {
    async.parallel({
      previous: function(cb) {
        getExistingHash(filePath, cacheDir, taskName, targetName, cb);
      },
      current: function(cb) {
        generateFileHash(filePath, cb);
      }
    }, function(err, hashes) {
      if (err) {
        return callback(err);
      }
      done(String(hashes.previous) !== String(hashes.current));
    });
  }, callback);
};


/**
 * Filter a list of file config objects based on comparing hashes of src files.
 * @param {Array.<Object>} files List of file config objects.
 * @param {string} taskName Task name.
 * @param {string} targetName Target name.
 * @param {function(Error, Array.<Object>)} callback Callback called with a
 *     filtered list of file config objects.  Object returned will only include
 *     src files with hashes that are different than any cached hashes.  Config
 *     objects with no src files will be filtered from the list.
 */
var filterFilesByHash = exports.filterFilesByHash = function(files, taskName,
    targetName, callback) {
  var modified = false;
  async.map(files, function(obj, done) {

    filterPathsByHash(obj.src, taskName, targetName, function(err, src) {
      if (err) {
        return done(err);
      }
      if (src.length) {
        modified = true;
      }
      done(null, {src: src, dest: obj.dest});
    });

  }, function(err, newerFiles) {
    callback(err, newerFiles, modified);
  });
};


/**
 * Get the path to the cached timestamp for a target.
 * @param {string} cacheDir Path to cache dir.
 * @param {string} taskName Task name.
 * @param {string} targetName Target name.
 * @return {string} Path to timestamp.
 */
var getStampPath = exports.getStampPath = function(cacheDir, taskName,
    targetName) {
  return path.join(cacheDir, taskName, targetName, 'timestamp');
};
