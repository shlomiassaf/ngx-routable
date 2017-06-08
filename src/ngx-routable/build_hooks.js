const globals = {
  '@angular/core': 'ng.core',
  '@angular/router': 'ng.router',
  'rxjs/Observable': 'Rx',
  'rxjs/Subject': 'Rx',
  'rxjs/operator/toPromise': 'Rx.Observable.prototype',
  'rxjs/operator/filter': 'Rx.Observable.prototype',
  'rxjs/operator/switchMap': 'Rx.Observable.prototype',
  'rxjs/operator/map': 'Rx.Observable.prototype',
  'rxjs/operator/takeUntil': 'Rx.Observable.prototype'
};


// module.exports.packageJSON = function(pkgJson) { };

module.exports.rollupFESM = function(config) {
  if (config.external) {
    config.external = config.external.concat(Object.keys(globals));
  } else {
    config.external = Object.keys(globals);
  }
};

module.exports.rollupUMD = function(config) {
  if (config.external) {
    config.external = config.external.concat(Object.keys(globals));
  } else {
    config.external = Object.keys(globals);
  }

  config.globals = Object.assign(config.globals || {}, globals);
};