import {
  Component,
  OnInit
} from '@angular/core';

import { AppState } from '../app.service';

import { Routable } from 'ngx-routable';

@Component({

  selector: 'home',  // <home></home>
  /**
   * Our list of styles in our component. We may add more to compose many styles together.
   */
  styleUrls: [ './home.component.css' ],
  /**
   * Every Angular template is first compiled by the browser before Angular runs it's compiler.
   */
  templateUrl: './home.component.html'
})
@Routable({
  resolve: () => {
    let resolve;
    const p = new Promise( (res, rej) => resolve = res );
    setTimeout(() => resolve({value: 15}), 2000);
    return p;
  }
})
export class HomeComponent implements OnInit {
  value: number;

  /**
   * Set our default values
   */
  public localState = { value: '' };
  /**
   * TypeScript public modifiers
   */
  constructor(
    public appState: AppState,
  ) {}

  public ngOnInit() {
    console.log('hello `Home` component');
    /**
     * this.title.getData().subscribe(data => this.data = data);
     */
  }

  public submitState(value: string) {
    console.log('submitState', value);
    this.appState.set('value', value);
    this.localState.value = '';
  }
}
