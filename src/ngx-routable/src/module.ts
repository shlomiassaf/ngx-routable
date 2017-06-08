import { NgModule, ModuleWithProviders } from '@angular/core';

import { RoutableOutlet } from './router-outlet.directive';
import { RoutableService } from './routable.service';

@NgModule({
  declarations: [RoutableOutlet],
  exports: [RoutableOutlet]
})
export class NgxRoutableModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: NgxRoutableModule,
      providers: [RoutableService]
    };
  }
}