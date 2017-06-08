const path = require('path');
const gulp = require('gulp');
const runSequence = require('run-sequence');

require('ts-node/register');
require('require-dir')(path.join(__dirname, 'scripts', 'gulp'));

const util = require('./scripts/util');

gulp.task('compile', ['clean:dist'], () => {
  const errHandler = (err) => {
    if (err) {
      console.log('ERROR:', err.message);
      // deleteFolders([distFolder, tmpFolder, buildFolder]);
    } else {
      console.log('Compilation finished succesfully');
    }
  };

  for (let pkg of util.libConfig.packages) {
    console.log(`Compiling library ${pkg}`);

    util.PKG_DIR_NAME = pkg;

    runSequence(
      'build:webpack',
      'build:rollup:fesm',
      'build:rollup:umd',
      'sourcemaps',
      'minifyAndGzip',
      'manifest',
      errHandler
    );
  }

});

gulp.task('build', ['compile']);