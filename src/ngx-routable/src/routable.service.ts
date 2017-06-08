import { Injectable } from '@angular/core';
import { Router, ActivatedRoute, ResolveData } from '@angular/router';

import { RoutableMetadataArgs } from './metadata';
import { RoutableBase } from './routable';

const ASSIGN_DATA_KEY = '$ASSIGN_DATA_KEY$';
// TODO: move to Symbols if/when the router supports them as valid ResolveData keys.
// const ASSIGN_DATA_KEY = Symbol('ROUTABLE ASSIGN DATA KEY');

@Injectable()
export class RoutableService extends RoutableBase {
  constructor(router: Router) {
    super(router);
    this.onActivate$.subscribe( e => this.applyStrategy(e.meta, e.instance, e.data, e.route));
  }

  /**
   * Apply a resolve strategy based on the metadata instructions.
   *
   * @param meta The RoutableMetadataArgs defined for the component
   * @param instance The instance fot he component
   * @param data The resolved data
   * @param route The ActivatedRoute
   */
  applyStrategy(meta: RoutableMetadataArgs<any>, instance: any, data: any, route: ActivatedRoute): void {
    let strategy: any = meta.assign;

    if (data && data[ASSIGN_DATA_KEY]) {
      Object.assign(instance, data[ASSIGN_DATA_KEY]);
      delete data[ASSIGN_DATA_KEY];
    }

    switch (typeof strategy) {
      case 'boolean':
        if (data && strategy === true) {
          Object.assign(instance, data);
        }
        break;
      case 'string':
        instance[strategy] = data;
        break;
      case 'function':
        strategy.call(instance, data, route);
        break;
    }
  }

  /**
   * Define the service in assign mode.
   * Assign mode is a transparent mode where the resolved value is merged into the instance.
   * Note that not the ResolveData object is merged but the resolved value.
   *
   * For example, the code below will merge the response from the `resolve` function into the
   * MyComponent instance.
   * Notice that the Routes configuration is not using an object literal to set the `ResolveData`
   * but using a special object returned from `RoutableService.ASSIGN`
   *
   * > Any other values in the ResolvedData object are treated based on the resolved strategy implementation.
   * ```ts
   * @Component({ selector: 'my-component' })
   * @Routable({
   *   resolve: () => {
   *     return {
   *       name: 'John',
   *       age: 33
   *     }
   *   }
   * })
   * export class MyComponent {
   *   name: string;
   *   age: number;
   * }
   *
   * export const ROUTES: Routes = [
   *   { path: 'myRoute', component: MyComponent, , resolve: RoutableService.ASSIGN }
   * ];
   * ```
   */
  static ASSIGN: ResolveData = { $ASSIGN_DATA_KEY$: RoutableService };
}
