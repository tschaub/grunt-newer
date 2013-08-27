# grunt-newer

Run [Grunt](http://gruntjs.com/) tasks with only the source files modified since the previous successful run.

## Getting Started
This plugin requires Grunt `~0.4.1`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [`gruntfile.js`](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-newer --save-dev
```

Once the plugin has been installed, it may be enabled inside your `gruntfile.js` with this line:

```js
grunt.loadNpmTasks('grunt-newer');
```

## The `newer` task

### Overview

The `newer` task doesn't take any special configuration.  To use it, just add `newer` as the first argument when running other tasks.

For example, if you want to run [JSHint](https://npmjs.org/package/grunt-contrib-jshint) on only those files that have been modified since the last successful run, configure the `jshint` task as you would otherwise, and then register a task with `newer` at the front.

```js
  grunt.initConfig({
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: {
        src: 'src/**/*.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-newer');

  grunt.registerTask('default', ['newer:jshint:all']);
```

With the above configuration, running `grunt` will configure your `jshint:all` task to use only files in the `src` config that have been modified since the last successful run of the same task.

To keep track of successful runs, the `newer` task writes files in the `.grunt` directory where it is run.  If you're running the task in a git repository, you'll want to add `.grunt` to your `.gitignore` file.


[![Current Status](https://secure.travis-ci.org/tschaub/grunt-newer.png?branch=master)](https://travis-ci.org/tschaub/grunt-newer)
