

/**
 * @param {Object} grunt Grunt.
 */
module.exports = function(grunt) {

  grunt.initConfig({
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      test: {
        options: {
          jshintrc: 'test/.jshintrc'
        },
        src: 'test/fixtures/**/*.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadTasks('tasks');

  grunt.registerTask('default', ['newer:jshint:test']);

};
