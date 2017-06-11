const path = require('path');
const gulp = require('gulp');
const runSequence = require('run-sequence');

require('ts-node/register');
require('require-dir')(path.join(__dirname, 'scripts', 'gulp'));

const util = require('./scripts/util');

gulp.task('compile', ['clean:dist'], (done) => {
  const packages = util.libConfig.packages.slice();

  const cleanup = () => util.cleanup().catch( err => {});

  const errHandler = (err) => {
    if (err) {
      console.log('ERROR:', err.message);
      cleanup().then( () => done(err) );
    } else {
      console.log(`Compilation for ${util.PKG_DIR_NAME} finished successfully`);
      if (packages.length > 0) {
        util.PKG_DIR_NAME = packages.shift();
        run();
      } else {
        console.log('No more libraries to compile. Done!');
        cleanup().then( () => done() );
      }
    }
  };


  const run = () => {
    console.log(`Compiling library ${util.PKG_DIR_NAME}`);

    runSequence(
      'build:webpack',
      'build:rollup:fesm',
      'build:rollup:umd',
      'sourcemaps',
      'minifyAndGzip',
      'manifest',
      errHandler
    );
  };

  util.PKG_DIR_NAME = packages.shift();
  run();

});

gulp.task('build', ['compile']);