// @flow
import bodyParser from 'body-parser';

import ApplicationAPI from './appdev/ApplicationAPI';
import Routers from './routers/index';

class API extends ApplicationAPI {
  getPath(): string {
    return '/api/';
  }

  middleware(): Array<Object> {
    return [bodyParser.json()];
  }

  routerGroups(): Object {
    const sharedRouters = [
      Routers.AlertsRouter,
      Routers.AllStopsRouter,
      Routers.DelayRouter,
      Routers.HelloWorldRouter,
      Routers.MultiRouteRouter,
      Routers.PlacesAutocompleteRouter,
      Routers.RouteSelectedRouter,
      Routers.SearchRouter,
      Routers.TrackingRouter,
    ];
    return {
      v1: [
        ...sharedRouters,
        Routers.RouteRouter,
      ],
      v2: [
        ...sharedRouters,
        Routers.RouteV2Router,
      ],
    };
  }
}

export default API;