import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';

import { Directive, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** @internal */
export const outletActivate = new Subject<OutletEvent>();
/** @internal */
export const outletDeactivate = new Subject<OutletEvent>();

/** @internal */
export interface OutletEvent<T = any> {
  outlet: RouterOutlet;
  instance: T;
}

/**
 * A directive that captures RouterOutlet instances
 */
@Directive({selector: 'router-outlet'})
export class RoutableOutlet implements OnDestroy {
  private subscriptions: Subscription[] = [];

  constructor(outlet: RouterOutlet) {
    this.subscriptions[0] = outlet.activateEvents
      .subscribe( instance => outletActivate.next({ outlet, instance }));

    this.subscriptions[1] = outlet.deactivateEvents
      .subscribe( instance => outletDeactivate.next({ outlet, instance }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe() );
  }
}