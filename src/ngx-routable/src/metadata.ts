import { Observable } from 'rxjs/Observable';
import { Type } from '@angular/core';
import { Router, RouterStateSnapshot, ActivatedRouteSnapshot, ActivatedRoute, ResolveData } from '@angular/router';


export const store = new Map<Type<any>, RoutableMetadataArgs<any>>();

/**
 * Interface that a routable target component can implement when it uses a direct property assignment strategy
 *
 * In the example below the structure of the resolved data (`ResolveData`) will always be `{ person: Person, value: number  }`.
 * We also set the `assign` to the string value "myData" which means that the whole
 * resolved data object will be assigned to property "myData" on the MyComponent instance.
 *
 * To make the class type-safe we implement `RoutableDataTarget<'myData', { person: Person, value: number  }>`
 *
 * ```ts
 * interface Person {
 *   name: string;
 *   age: number;
 * }
 *
 * @Component({ selector: 'my-component' })
 * @Routable({
 *   assign: 'myData',
 *   resolve: () => {
 *     return { name: 'John', age: 33 }
 *   }
 * })
 * export class MyComponent implements RoutableDataTarget<'myData', { person: Person, value: number  }> {
 *   myData: { person: Person, value: number  };
 * }
 *
 * export const ROUTES: Routes = [
 *   { path: 'myRoute', component: MyComponent, , resolve: { person: RoutableService, value: 15 } }
 * ];
 */
export type RoutableDataTarget<T extends string, Z extends ResolveData = ResolveData> = { [P in T]: Z };

export interface RoutableMetadataArgs<T> {

  /**
   * The assignment handling strategy between the resolved data and the component instnace.
   *
   *   - true: merge (Object.assign) the resolved data object into the component instance
   *   - string: A direct property assignment strategy, the property name on the instance to assign the ResolveData to.
   *   - function: a function with the instance as context (this) the function accepts the resolved data object and the ActivatedRoute.
   *
   * > NOTE: `assign` will not handle resolved values via ASSIGN mode. see RoutableService#ASSIGN.
   *
   * > NOTE: If you want to implement some logic after the data has been resolved and assigned use
   * the RouteActivated and not `assign`.
   */
  assign?: true | keyof T | ( (this: any, data: any, route?: ActivatedRoute) => void );

  resolve?(route?: ActivatedRouteSnapshot,
           state?: RouterStateSnapshot,
           router?: Router): Observable<any> | Promise<any> | any;
}

/**
 * Declare routing behaviour for a component that is a route endpoint.
 * @param metaArgs
 * @return {(target:(Z&Type<T>))=>undefined}
 * @constructor
 */
export function Routable<T = any, Z = any>(metaArgs: RoutableMetadataArgs<T>): (target: Z & Type<T>) => ((Z & Type<T>) | void) {
  return (target: Z & Type<T>) => {
    store.set(target, metaArgs);
  }
}