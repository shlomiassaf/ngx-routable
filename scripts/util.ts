import * as fs from 'fs-extra';
import * as Path from 'path';
import * as voca from 'voca';
import * as jsonfile from 'jsonfile';
import { CompilerOptions } from 'typescript';
import { AngularCompilerOptions } from '@angular/tsc-wrapped';

const uglify = require('uglify-js');
const zlib = require('zlib');


const PKG_METADATA_CACHE: { [dirName: string]: PackageMetadata } = {};

export const FS_REF = {
  PKG_DIST: 'dist_package',
  BUNDLE_DIR: 'bundle',
  NG_COMPILE: 'compiled',
  WEBPACK_CONFIG: 'config/webpack.package.ts',
  TS_CONFIG_TEMPLATE: 'tsconfig.package.json',
  TS_CONFIG_TMP: '.tsconfig.tmp.json',
  SRC_CONTAINER: 'src',
  NG_FLAT_MODULE_EXT: '.ng-flat'
};

export function getPackageName(name?: string) {
  const scope = libConfig.scope ? `${libConfig.scope}/` : '';
  return scope + (name || PKG_DIR_NAME);
}
/**
 * Returns an array of external dependencies based on package.json dependencies and peerDependencies
 * @param packageJson
 * @return {string[]}
 */
function getExternalsRaw(packageJson): string[] {
  const deps = Object.assign({}, packageJson.dependencies || {}, packageJson.peerDependencies || {});
  return Object.keys(deps)
}

/**
 * Returns a regex array of externals (for use with webpack externals
 * @param packageJson
 * @return {any}
 */
function getExternalsWebpack(packageJson): RegExp[] {
  return [getPackageName(packageJson.name), ...getExternalsRaw(packageJson)]
    .reduce( (arr, name) => {
      arr.push(new RegExp('^' + name.replace(`\\`, '\/')));
      return arr;
    }, []);
}

function titleCamelCase(value) {
  return value[0].toUpperCase() + voca.camelCase(value).substr(1);
}

export const ROOT = Path.resolve(__dirname, '..');

export function root(...args: string[]): string {
  return Path.join(ROOT, ...args);
}

export const libConfig = jsonfile.readFileSync(root('package.json')).libConfig;
export let PKG_DIR_NAME;

if (libConfig.scope && libConfig.scope.substr(0, 1) !== '@') {
  libConfig.scope = '@' + libConfig.scope;
}

export interface PackageMetadata {
  name: string;

  /**
   * The directory name, with scope (if exists)
   *
   * For example, if the directory name is "lib" and the scope is "corp" dir will be "@corp/lib"
   *
   * When no scope dir === dirName
   */
  dir: string;

  /**
   * The directory name, without scope
   *
   * When no scope dir === dirName
   */
  dirName: string;

  umd: string;

  /**
   * A list of the names of external dependencies (based on package.json)
   */
  externals: string[],

  /**
   * A list of regexp of external dependencies (based on package.json)
   */
  externalsWebpack: Array<RegExp | string>;

  isFlatStructure: boolean;
  tsConfig: string;
  tsConfigObj: { compilerOptions: CompilerOptions, angularCompilerOptions: AngularCompilerOptions };
}

export function buildPackageMetadata(dirName: string): PackageMetadata {
  if (PKG_METADATA_CACHE[dirName]) {
    return PKG_METADATA_CACHE[dirName];
  }

  const packageSrcPath = Path.join(root(FS_REF.SRC_CONTAINER, dirName, 'src'));
  const pkgJson = jsonfile.readFileSync(root(FS_REF.SRC_CONTAINER, dirName, 'package.json'));

  const isFlatStructure = !fs.readdirSync(packageSrcPath)
    .some( fsItem => fs.statSync(Path.join(packageSrcPath, fsItem)).isDirectory() );

  const scope = libConfig.scope ? `${libConfig.scope}/` : '';

  const meta: PackageMetadata = {
    name: titleCamelCase(dirName),
    dirName,
    dir: scope + dirName,
    umd: dirName,
    externals: getExternalsRaw(pkgJson),
    externalsWebpack: [/^\@angular\//].concat(getExternalsWebpack(pkgJson)),
    isFlatStructure,
    tsConfig: `./${FS_REF.TS_CONFIG_TMP}`,
    tsConfigObj: undefined
  };

  const tsConfig = tsConfigUpdate(jsonfile.readFileSync(root(FS_REF.TS_CONFIG_TEMPLATE)), meta);
  jsonfile.writeFileSync(root(FS_REF.TS_CONFIG_TMP), tsConfig, {spaces: 2});
  meta.tsConfigObj = tsConfig;

  return PKG_METADATA_CACHE[dirName] = meta;
}

export function resolveWebpackConfig(config: string | any, ...args: any[]): any {
  if(typeof config === 'string') {
    return resolveWebpackConfig(require(config), ...args);
  } else if (typeof config === 'function') {
    return config(...args);
  } else if (config.__esModule === true && !!config.default) {
    return resolveWebpackConfig(config.default, ...args);
  } else {
    return config;
  }
}

export function tsConfigUpdate<T extends any>(config: T, meta: PackageMetadata): T {
  if (!config.compilerOptions.outDir.endsWith('/')) {
    config.compilerOptions.outDir +=  '/';
  }

  config.compilerOptions.outDir += `.tmp`;

  if (libConfig.scope) {
    config.compilerOptions.outDir += `/${libConfig.scope}`;
  }

  if (meta.isFlatStructure) {
    config.compilerOptions.outDir += `/${meta.dirName}`;
  }

  // TODO: check why this go outside of folder
  // config.include = [`./src/${dirName}/src/**/*.ts`];
  config.files = [`./src/${meta.dir}/src/index.ts`];

  config.angularCompilerOptions = {
    annotateForClosureCompiler: true,
    strictMetadataEmit: true,
    skipTemplateCodegen: true,
    flatModuleOutFile: `${meta.umd}${FS_REF.NG_FLAT_MODULE_EXT}.js`,
    flatModuleId: meta.name
  };

  config.compilerOptions.baseUrl = `./${FS_REF.SRC_CONTAINER}`;
  config.compilerOptions.paths = {
    [meta.dir]: [`${meta.dir}/src/index.ts`],
    [`${meta.dir}/*`]: [`${meta.dir}/src/*`]
  };

  return config;
}

/**
 * Giving the output directory from a tsconfig, returns the source and destination to move the output (from/to)
 * @param outDir
 * @param meta
 * @return {{from: string, to: string}}
 */
export function getCopyInstruction(outDir: string, meta: PackageMetadata): { from: string; to: string} {
  if (!outDir.endsWith(`/${meta.dir}`)) {
    outDir = Path.join(outDir, meta.dir);
  }

  let from = Path.join(outDir, 'src');
  let to = Path.resolve(outDir, '..', '..', meta.dir);
  if (!fs.existsSync(from)) {
    from = outDir;
  }
  return { from, to };
}

/**
 * Minify and gzip a umd bundle.
 *
 * The output files will sit along side the umd bundle.
 *
 * NOTE: this is a sync operation.
 *
 * @param destDir the destination directory
 * @param umd the umd name (from metadata, not the while filename) of the bundle
 */
export function minifyAndGzip(destDir: string, srcNameNoExt: string) {
  const unminified = fs.readFileSync(Path.join(destDir, `${srcNameNoExt}.js`)).toString();
  const minified = uglify.minify(unminified);
  const gzipBuffer = zlib.gzipSync(Buffer.from(minified.code));

  fs.writeFileSync(Path.join(destDir, `${srcNameNoExt}.min.js`), minified.code, 'utf-8');
  const zipStream = fs.createWriteStream(Path.join(destDir, `${srcNameNoExt}.js.gz`));
  zipStream.write(gzipBuffer);
  zipStream.end();

  const pct = num => 100 * Math.round(10000 * (1-num)) / 10000;

  console.log(`
          --------------------------------------
          UMD Bundle info: ${srcNameNoExt}
          --------------------------------------
          unminified: \t${unminified.length / 1000} KB
          minified: \t${minified.code.length / 1000} KB \t(${pct(minified.code.length / unminified.length)} %)
          gzipped: \t${gzipBuffer.length / 1000} KB \t(${pct(gzipBuffer.length / unminified.length)}) %, ${pct(gzipBuffer.length / minified.code.length)} %)
          --------------------------------------
        `);
}

export function tryRunHook(pkgDir: string,
                           hookName: 'rollupUMD' | 'rollupFESM' | 'packageJSON',
                           ...args: any[]): void {
  try {
    const moduleId = require.resolve(root(FS_REF.SRC_CONTAINER, pkgDir, 'build_hooks'));
    const module = require(moduleId);
    if (typeof module[hookName] === 'function') {
      module[hookName](...args);
    }
  } catch (err) { }

}