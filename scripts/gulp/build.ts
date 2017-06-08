import * as gulp from 'gulp';
import * as fs from 'fs-extra';
import * as Path from 'path';
import { execSync as spawn } from 'child_process';
import * as webpack from 'webpack';
import * as util from '../util';

const rollup = require('rollup-stream');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const sorcery = require('sorcery');
const convert = require('convert-source-map');


gulp.task('build:webpack', () => {
  const meta = util.buildPackageMetadata(util.PKG_DIR_NAME);

  const config = util.resolveWebpackConfig(util.root(util.FS_REF.WEBPACK_CONFIG), meta);

  const compiler = webpack(config);

  const runWebpack = {
    compiler,
    done: new Promise( (RSV, RJT) => compiler.run((err, stats) => err ? RJT(err) : RSV(stats)) )
  };

  return runWebpack
    .done
    .then( () => {
      let p = util.root(meta.tsConfigObj.compilerOptions.outDir);
      const copyInst = util.getCopyInstruction(p, meta);

      spawn(`mv ${copyInst.from}/* ${copyInst.to}`);
      spawn(`rm -rf ${Path.resolve(p, '..')}`);
      spawn(`rm -rf ${Path.resolve(p, '..')}`);


      /*
          Angular compiler with 'flatModuleOutFile' turned on creates an entry JS file with a matching d.ts
          file and an aggregated metadata.json file.

          This is done by creating a corresponding TS file (to the output JS file).
          The side-effect is a source map reference to the TS file.

          Since the TS is virtual and does not exists we need to remove the comment so the source maps
          will not break.
       */
      const flatModuleJsPath = Path.join(copyInst.to, `${meta.umd}${util.FS_REF.NG_FLAT_MODULE_EXT}.js`);
      const withoutComments = convert.removeComments(fs.readFileSync(flatModuleJsPath, 'utf-8'));
      fs.writeFileSync(flatModuleJsPath, withoutComments, 'utf-8');
    });

});

gulp.task('build:rollup:fesm', function () {
  const meta = util.buildPackageMetadata(util.PKG_DIR_NAME);

  let p = util.root(meta.tsConfigObj.compilerOptions.outDir);
  const copyInst = util.getCopyInstruction(p, meta);

  const rollupConfig = {
    external: meta.externals
  };

  util.tryRunHook(meta.dir, 'rollupFESM', rollupConfig);

  Object.assign(rollupConfig, {
    entry: `${copyInst.to}/${meta.umd}${util.FS_REF.NG_FLAT_MODULE_EXT}.js`,
    format: 'es',
    sourceMap: true
  });

  return rollup(rollupConfig)
    .pipe(source(`${meta.umd}${util.FS_REF.NG_FLAT_MODULE_EXT}.js`, `${copyInst.to}`))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(rename(`${meta.umd}.es5.js`))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(Path.join(copyInst.to, util.FS_REF.BUNDLE_DIR)));
});

gulp.task('build:rollup:umd', function () {
  const meta = util.buildPackageMetadata(util.PKG_DIR_NAME);

  let p = util.root(meta.tsConfigObj.compilerOptions.outDir);
  const copyInst = util.getCopyInstruction(p, meta);

  const rollupConfig = {
    external: meta.externals,
    globals: {
      typescript: 'ts'
    },
    moduleName: meta.name
  };

  util.tryRunHook(meta.dir, 'rollupUMD', rollupConfig);

  Object.assign(rollupConfig, {
    entry: `${copyInst.to}/${meta.umd}${util.FS_REF.NG_FLAT_MODULE_EXT}.js`,
    format: 'umd',
    exports: 'named',
    sourceMap: true
  });

  return rollup(rollupConfig)
    .pipe(source(`${meta.umd}${util.FS_REF.NG_FLAT_MODULE_EXT}.js`, `${copyInst.to}`))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(rename(`${meta.umd}.rollup.umd.js`))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(Path.join(copyInst.to, util.FS_REF.BUNDLE_DIR)));
});

gulp.task('sourcemaps', () => {
  const meta = util.buildPackageMetadata(util.PKG_DIR_NAME);

  let p = util.root(meta.tsConfigObj.compilerOptions.outDir);
  const copyInst = util.getCopyInstruction(p, meta);

  const promises = [`${meta.umd}.es5.js`, /* `${meta.umd}.webpack.umd.js`, */ `${meta.umd}.rollup.umd.js`]
    .map( file => {
      return sorcery.load(Path.join(copyInst.to, util.FS_REF.BUNDLE_DIR, file))
        .then( chain => chain.write() );
    });

  return Promise.all(promises);
});

gulp.task('minifyAndGzip', () => {
  const meta = util.buildPackageMetadata(util.PKG_DIR_NAME);

  let p = util.root(meta.tsConfigObj.compilerOptions.outDir);
  const copyInst = util.getCopyInstruction(p, meta);

  util.minifyAndGzip(Path.join(copyInst.to, util.FS_REF.BUNDLE_DIR), `${meta.umd}.webpack.umd`);
  util.minifyAndGzip(Path.join(copyInst.to, util.FS_REF.BUNDLE_DIR), `${meta.umd}.rollup.umd`);
});