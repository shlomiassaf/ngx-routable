import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { toPromise } from 'rxjs/operator/toPromise';
import { filter } from 'rxjs/operator/filter';
import { switchMap } from 'rxjs/operator/switchMap';
import { map } from 'rxjs/operator/map';
import { takeUntil } from 'rxjs/operator/takeUntil';

import { Router, Resolve, RouterStateSnapshot, ActivatedRouteSnapshot, ActivatedRoute, ResolveData } from '@angular/router';

import { store, RoutableMetadataArgs } from './metadata';
import { OutletEvent, outletActivate, outletDeactivate } from './router-outlet.directive';


export interface RoutableActivatedEvent {
  meta: RoutableMetadataArgs<any>;
  instance: any;
  data: any;
  route: ActivatedRoute;
}

/**
 * Custom lifecycle hook that is called after route pointing to a component was activated.
 * This hooks also represents the point in time where assignment strategies ran and resolved data
 * can be accessed.
 *
 * Component must be decorated with a `@Routable` decorator.
 *
 * RouteActivated is fired BEFORE angular's `OnInit` lifecycle hook. (4.1.x and down see note below)
 *
 * > If you are running angular 4.1.x and below RouteActivated will fire AFTER angular's lifecycle hooks.
 * This means that the hook will fire after `AfterViewInit` (this after `OnInit` as well).
 *
 *
 */
export interface RouteActivated {
  ngOnRouteActivated(route?: ActivatedRoute, data?: ResolveData): void;
}

/**
 * A base class for a Routable services
 */
export class RoutableBase implements Resolve<any> {


  readonly onActivate$: Observable<RoutableActivatedEvent>;
  protected activated$: Subject<RoutableActivatedEvent>;

  constructor(protected router: Router) {
    this.activated$ = new Subject<RoutableActivatedEvent>();
    this.onActivate$ = this.activated$.asObservable();
  }

  /**
   * Returns the RoutableMetadataArgs for the activated route supplied, if exists.
   *
   * @param route
   * @return {RoutableMetadataArgs}
   */
  meta(route: ActivatedRouteSnapshot): RoutableMetadataArgs<any> | undefined {
    const cmp = withComponent(route);
    return cmp
      ? store.get(<any>cmp.component) // TODO: route.component can be a string, find out why/how and handle.
      : undefined
    ;
  }

  /**
   * Handles `Resolve` hooks from the Router.
   * Do not override this method, use other methods instead.
   * @param route
   * @param state
   * @return {any}
   */
  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<any> | Promise<any> | any {
    const actualRoute = withComponent(route);
    const meta = this.meta(actualRoute);

    if (meta && meta.resolve) {
      // A stream that triggers when an outlet matching the route activate.
      // the stream will resolve the data and auto-terminate once the route deactivate.
      switchMap.call(
        filter.call(outletActivate, ol => ol.outlet.activatedRoute.snapshot === actualRoute),
        mapAndTerminate$
      )
        .subscribe( ({outletEvent, data}) => {
          const instance = outletEvent.instance;
          this.activated$.next({
            meta,
            instance,
            data,
            route: outletEvent.outlet.activatedRoute
          });

          if (typeof instance.ngOnRouteActivated === 'function') {
            instance.ngOnRouteActivated(route, data);
          }
        });

      return wrapToPromise(meta.resolve(route, state, this.router))
        .then( data => this.transformResolvedData(data, route, state, this.router) );
    } else {
      return null;
    }
  }


  /**
   * A chance to transform the resolved data AFTER the user's custom resolve function.
   *
   * The default implementation is just a pass-through.
   *
   * > Override this method in derived classes to implement custom behaviour.
   *
   * For example, implementing resolver service that uses `@angular/http` to retrieve data.
   * The metadata defined on the component will just return a transient object containing the url
   *
   * @param data
   * @param route
   * @param state
   * @param router
   * @return {any}
   */
  transformResolvedData(data: any,
                route: ActivatedRouteSnapshot,
                state: RouterStateSnapshot,
                router: Router): Observable<any> | Promise<any> | any {
    return data;
  }
}

function withComponent(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot | undefined {
  if (route.component) {
    return route;
  } else {
    // this is a simple top-down search, no smart logic. first item (depth first) wins
    // TODO: add some logic to check for multiple children, outlets etc...
    for (let i = 0, len = route.children.length; i<len; i++) {
      const t = withComponent(route.children[i]);
      if (t) return t;
    }
  }
}

/**
 * A function that accepts a stream of OutletEvent and returns an observable that outputs a stream
 * of OutletEvent and data resolved for that event. The stream will auto-terminate once the outlet
 * is deactivated
 * @param outletEvent
 * @return {any}
 */
function mapAndTerminate$ (outletEvent: OutletEvent): Observable<{ outletEvent: OutletEvent, data: any }> {
  return takeUntil.call(
    map.call(outletEvent.outlet.activatedRoute.data, data => ({outletEvent, data})),
    filter.call(outletDeactivate, deactivated => deactivated.instance === outletEvent.instance)
  );
}

/**
 * Determine if the argument is an Observable
 */
function isObservable(obj: any | Observable<any>): obj is Observable<any> {
  // TODO use Symbol.observable when https://github.com/ReactiveX/rxjs/issues/2415 will be resolved
  return !!obj && typeof obj.subscribe === 'function';
}

function wrapToPromise(value: any): Promise<any> {
  return isObservable(value)
    ? toPromise.call(value)
    : Promise.resolve(value)
  ;
}