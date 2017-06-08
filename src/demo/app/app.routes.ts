import { Routes } from '@angular/router';
import { HomeComponent } from './home';
import { NoContentComponent } from './no-content';

import { RoutableService } from 'ngx-routable';

export const ROUTES: Routes = [
  { path: '',      component: HomeComponent, resolve: RoutableService.ASSIGN },
  { path: 'home',  component: HomeComponent },
  { path: '**',    component: NoContentComponent },
];
