# ngx-routable

Component metadata driven routing hooks for angular

> Use metadata to declaratively set the routing behaviors of a component.

```
npm install ngx-routable
```

### Resolving

The router comes with a mechanisem to pre-fetch data before the page loads.
Each route has to declare it has a resolver and a resolver must be an angular service.

Using a service for each component (or model) does not make sense, it does not scale.
While this separates the fetching of data from the component it requires having a service
for each component that requires some logic to get the data.

**ngx-routable** provides a declarative way to resolve or define parameters
for how to resolve. It can also automatically assign the resolved data
into the instance or let the component do that manually.

```ts
import { Component } from '@angular/core';
import { Routable, RoutableService } from 'ngx-routable';

@Component({
  selector: 'my-component',
  template: ''
})
@Routable({
  assign: 'myData',
  resolve: () => {
    let resolve;
    const p = new Promise( (res, rej) => resolve = res );
    setTimeout(() => resolve({value: 15}), 2000);
    return p;
  }
})
export class MyComponent {
  myData: {
    mock: {value: number}
  };
}

export const ROUTES: Routes = [
  { path: 'myRoute', component: MyComponent, , resolve: { mock: RoutableService } }
];
```

In the example above we can see a custom resolver defined to resolve the value
`{value: 15}` after 2 seconds.

We also declare to assign the resolved data to property `myData` on the component instance.

> This is a direct assignment of the resolved data from the router (`ResolvedData`)
which means that the object resolved is the one we defined on the `Route` config.

If `assign` is not set nothing will be assigned to the instance.

#### Getting notified on data arrival
You can easily opt-in to get notified when the data arrives using a lifecycle hook.
When the hook fires it means that the data has arrived and assigned to the instance.

```ts
import { Component } from '@angular/core';
import { ActivatedRoute, ResolveData } from '@angular/router';
import { Routable, RoutableService, RouteActivated } from 'ngx-routable';

@Component({
  selector: 'my-component',
  template: ''
})
@Routable({
  assign: 'myData',
  resolve: () => { /* same as previous example */ }
})
export class MyComponent implements RouteActivated {
  myData: {
    mock: {value: number}
  };

  ngOnRouteActivated(route: ActivatedRoute, data: ResolveData): void {
    this.groupClicked(this.authGroups[0]);
  }
}

export const ROUTES: Routes = [
  { path: 'myRoute', component: MyComponent, , resolve: { mock: RoutableService } }
];
```

RouteActivated is fired BEFORE angular's `OnInit` lifecycle hook. (4.1.x and down see note below)

> If you are running angular 4.1.x and below RouteActivated will fire AFTER angular's lifecycle hooks.
This means that the hook will fire after `AfterViewInit` (thus after `OnInit` as well).

The parameters in `ngOnRouteActivated` are both optional so you can omit them in the implementation.

> The sharp eyed developer probably noticed that you can use `ngOnRouteActivated`
to assign the data manually, while this is true it is not recommended.
There are other methods to achieve that.

#### Controlling the assignment logic
Up until this point assigning was done by applying the whole resolved data to a property on the instance.
There are other options to choose from:

```ts
assign?: true | keyof T | ( (this: any, data: any, route?: ActivatedRoute) => void );
```

  - true:  merge (Object.assign) the resolved data object into the component instance
  - string: A direct property assignment strategy, the property name on the instance to assign the ResolveData to.
  - function: a function with the instance as context (this) the function accepts the resolved data object and the ActivatedRoute.

#### Magic assignment
A special assignment mode is available, this mode merge's the **resolved result** into
the instance.

> Note that **resolved result** is not **resolved data**, the result is
only the data returned from the resolve method while the **resolved data** is the whole object return from the router's resolve process.

```ts
import { Component } from '@angular/core';
import { Routable, RoutableService } from 'ngx-routable';

@Component({
  selector: 'my-component',
  template: ''
})
@Routable({
  resolve: () => { return {value: 15}; }
})
export class MyComponent {
  value: number

}

export const ROUTES: Routes = [
  { path: 'myRoute', component: MyComponent, , resolve: RoutableService.ASSIGN }
];
```

Using `RoutableService.ASSIGN` as the value for the `resolve` property on the `Route` config
declares the special assign mode.

The returned object is merged directly into the instance, and only it.

This method provides an easy and safe convention to deal with resolvers.

> Using `assign` with `RoutableService.ASSIGN` is allowed, however the specific
resolved value will not be available when applying the assign logic.
Such scenario will be a cascading resolve process where a top level `Route` config
also resolves.

### Extending behaviour
`RoutableService` provides simple logic for resolving and assignment but
it does not contain domain specific logic.

For true scalability you will have to extend `RoutableService` and provide your own logic.
In most cases, it is best practice to use your own service.

A good example is resolving resources using the `Http` service:

Say we want to resolve a resource from a remote server.
Each component knows what resource it wants.

Using angular's `Http` service in our components is not a good solution.
Our goal is to decouple this into services, if you try to inject `Http` into the component
and then use **ngx-routable** then the library is no good.

Furthermore, the resolve method has fixed parameters (i.e. no DI) and it
runs before the instance is created so you can not get a hold of `Http`.

Instead, extend `RoutableService` (or compose with it) to your own custom service
and use it to invoke call to the server using the `Http` service.

Your components will resolve metadata to you, that is, the URL to fetch from.

```ts
import { Component, Injectable } from '@angular/core';
import { Http } from '@angular/http';
import { Router, RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { Routable, RoutableService } from 'ngx-routable';

@Injectable()
export class HttpRoutableService extends RoutableService {
  constructor(private http: Http) { }

  transformResolvedData(data: any,
                        route: ActivatedRouteSnapshot,
                        state: RouterStateSnapshot,
                        router: Router): Observable<any> | Promise<any> | any {
    return this.http.get(data);
  }
}

@Component({
  selector: 'my-component',
  template: ''
})
@Routable({
  resolve: () => { return 'http://www.resource-worls/my-resource' }
})
export class MyComponent { }

```

Now, use `HttpRoutableService` instead of `RoutableService` when you define routes.

While this example is basic, real-world implementation will need to support
a dynamic environment where the URL resolved changes based on route parameters, query string etc...

This can be easily handled by each resolve method.
```ts
resolve?(route?: ActivatedRouteSnapshot,
           state?: RouterStateSnapshot,
           router?: Router): Observable<any> | Promise<any> | any;
```

Since it provides you with the `ActivatedRouteSnapshot`, `RouterStateSnapshot` and `Router`
getting the right URL is an easy task.

Yet, handling this for each resolver is not a good idea, we better off handle
it in one central location, which is our service.


```ts
  transformResolvedData(data: any,
                        route: ActivatedRouteSnapshot,
                        state: RouterStateSnapshot,
                        router: Router): Observable<any> | Promise<any> | any {
    // build the URL here using information from the router.
    return this.http.get(data);
  }
```

___

### TODO

 - [ ] Implement other Router hooks
 - [ ] Install Jest and write some Unit tests
 - [ ] Add examples to the demo
 - [ ] publish gh-pages


---
# License
 [MIT](/LICENSE)
