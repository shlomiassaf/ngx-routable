const path = require('path');
const gulp = require('gulp');
const runSequence = require('run-sequence');

require('ts-node/register');
require('require-dir')(path.join(__dirname, 'scripts', 'gulp'));

const util = require('./scripts/util');

function filterPackageSelection(packages) {
  const idx = process.argv.indexOf('--select');

  if (idx > -1) {
    if (!process.argv[idx+1]) {
      throw new Error('Invalid library selection.')
    }
    const selected = process.argv[idx + 1].split(',').map( v => v.trim() );
    selected.forEach( s => {
      if (packages.indexOf(s) === -1) {
        throw new Error(`Could not apply selection, "${s}" is not a known package name.`);
      }
    });
    packages = selected;
  }

  return packages;
}

gulp.task('compile', ['clean:dist'], (done) => {
  try {
    let timeStart;
    const packages = filterPackageSelection(util.libConfig.packages.slice());

    if (packages.length === 0) {
      return done(new Error('Invalid configuration, no packages found.'));
    }

    if (packages.length > 1) {
      util.log(`Compiling libraries:\n\t- ${packages.join('\n\t- ')}`);
    }

    const cleanup = () => util.cleanup().catch( err => {});

    const errHandler = (err) => {
      if (err) {
        util.log('ERROR:', err.message);
        cleanup().then( () => done(err) );
      } else {
        const timeEnd = process.hrtime(timeStart);

        util.log(
          `=============================================
Compile OK: ${util.PKG_DIR_NAME} (${Math.round((timeEnd[0] * 1000) + (timeEnd[1] / 1000000))} ms)
=============================================`);
        if (packages.length > 0) {
          util.PKG_DIR_NAME = packages.shift();
          run();
        } else {
          util.log('No more libraries to compile. Done!');
          cleanup().then( () => done() );
        }
      }
    };


    const run = () => {
      util.log(
        `

=============================================
Compiling library ${util.PKG_DIR_NAME}
=============================================

`);

      timeStart = process.hrtime();

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
  } catch (err) {
    done(err);
  }
});

gulp.task('build', ['compile']);