var assert = require('assert');
var path = require('path');
var fs = require('fs');


/**
 * @param {Object} grunt Grunt.
 */
module.exports = function(grunt) {

  var scratch = path.join('.cache', 'newer', 'scratch');
  var fixtures = path.join(__dirname, 'fixtures');
  var src = '**/*.*';

  var gruntfileSrc = 'gruntfile.js';
  var tasksSrc = 'tasks/**/*.js';
  var fixturesSrc = 'fixtures/**/*.js';

  grunt.initConfig({

    integration: {
      basic: {
        src: path.join(scratch, src),
        modify: [path.join(scratch, 'one.js')]
      },
      none: {
        src: path.join(scratch, src),
        modify: []
      },
      all: {
        src: path.join(scratch, src),
        modify: path.join(scratch, src)
      },
      someFiles: {
        modify: path.join(scratch, 'two.js'),
        files: [{
          src: path.join(scratch, src)
        }]
      },
      filesObj: {
        modify: path.join(scratch, 'one.js'),
        files: {
          foo: path.join(scratch, src)
        }
      }
    },

    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      gruntfile: {
        src: gruntfileSrc
      },
      tasks: {
        src: tasksSrc
      },
      fixtures: {
        src: fixturesSrc
      }
    },

    watch: {
      all: {
        files: [gruntfileSrc, tasksSrc, fixturesSrc],
        tasks: ['newer:jshint', 'integration']
      }
    }

  });

  grunt.loadTasks('tasks');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');

  /**
   * Integration tests.
   *  - clean: remove any timestamps and copied fixtures from previous runs
   *  - setup: copy fixtures to scratch directory
   *  - initial: first run of target to simulate fresh setup
   *  - modify: modify files
   *  - repeat: subsequent runs of target to simulate repeat runs
   */

  grunt.registerTask('clean', 'Remove all timestamps', function() {
    Object.keys(grunt.config('integration')).forEach(function(target) {
      var timestamps = grunt.config([target, 'timestamps']);
      if (timestamps) {
        if (grunt.file.exists(timestamps)) {
          grunt.file.delete(timestamps);
        }
      }
    });
    if (grunt.file.exists('.cache')) {
      grunt.file.delete('.cache');
    }
  });

  grunt.registerTask('setup', 'Copy fixtures', function() {
    grunt.file.expand(path.join(fixtures, src)).forEach(function(absolute) {
      var relative = path.relative(fixtures, absolute);
      grunt.file.copy(absolute, path.join(scratch, relative));
    });
  });

  grunt.registerTask('initial', 'Initial run of task', function(name, target) {
    grunt.task.run('newer:' + name + ':' + target);
  });

  grunt.registerTask('modify', 'Modify files', function(name, target) {
    var modified = grunt.file.expand(grunt.config([name, target, 'modify']));
    modified.forEach(function(filepath) {
      var later = new Date(Date.now() + 120 * 1000);
      fs.utimesSync(filepath, later, later);
      grunt.verbose.writeln('Updating mtime for file: ' + filepath, later);
    });
  });

  grunt.registerTask('repeat', 'Repeat run of task', function(name, target) {
    grunt.task.run('newer:' + name + ':' + target + ':repeat');
  });

  grunt.registerMultiTask('integration', function(repeat) {
    /**
     * Integration tests make assertions about the files they are provided on
     * repeat runs.  The `newer` task reconfigures multi-task targets so that
     * the `filesSrc` array only includes files that were modified since the
     * last run of the same task.
     */
    if (repeat) {
      var modified = grunt.file.expand(
          grunt.config([this.name, this.target, 'modify']));
      assert.deepEqual(this.filesSrc, modified);
    }
  });

  var tasks = Object.keys(grunt.config('integration')).map(function(target) {
    var wrapper = 'integration-' + target;
    var actual = 'integration:' + target;
    grunt.registerTask(wrapper, ['clean', 'setup',
      'initial:' + actual, 'modify:' + actual, 'repeat:' + actual]);
    return wrapper;
  });

  grunt.registerTask('integration-tests', tasks);

  grunt.registerTask('test', ['jshint', 'integration-tests']);

  grunt.registerTask('default', 'test');

};
