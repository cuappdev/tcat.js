// @flow
import fuzz from 'fuzzball';
import LRU from 'lru-cache';
import type Request from 'express';
import AllStopUtils from '../../utils/AllStopUtils';
import ApplicationRouter from '../../appdev/ApplicationRouter';
import RequestUtils from '../../utils/RequestUtils';
import Constants from '../../utils/Constants';

const BUS_STOP = 'busStop';
const queryToPredictionsCacheOptions = {
  max: 10000, // Maximum size of cache
  maxAge: 1000 * 60 * 60 * 24 * 5, // Maximum age in milliseconds
};
const placeIDToCoordsCacheOptions = {
  max: 10000, // Maximum size of cache
};
const queryToPredictionsCache = LRU(queryToPredictionsCacheOptions);
const placeIDToCoordsCache = LRU(placeIDToCoordsCacheOptions);
const GOOGLE_PLACE = 'googlePlace';
const GOOGLE_PLACE_LOCATION = '42.4440,-76.5019';
const MIN_FUZZ_RATIO = 75;

class SearchRouter extends ApplicationRouter<Array<Object>> {
  constructor() {
    super(['POST']);
  }

  getPath(): string {
    return '/search/';
  }

  async content(req: Request): Promise<Array<Object>> {
    if (!req.body || !req.body.query || typeof req.body.query !== 'string') {
      return [];
    }

    const query = req.body.query.toLowerCase();
    const cachedValue = queryToPredictionsCache.get(query);

    const allStops = await AllStopUtils.fetchAllStops();
    const filteredStops = allStops.filter(s => (
      fuzz.partial_ratio(s.name.toLowerCase(), query) >= MIN_FUZZ_RATIO
    ));
    filteredStops.sort((a, b) => {
      const aPartialRatio = fuzz.partial_ratio(query, a.name.toLowerCase());
      const bPartialRatio = fuzz.partial_ratio(query, b.name.toLowerCase());
      return bPartialRatio - aPartialRatio;
    });
    const formattedStops = filteredStops.map(s => ({
      type: BUS_STOP,
      lat: s.lat,
      long: s.long,
      name: s.name,
    }));

    // Return the list of googlePlaces and busStops
    if (cachedValue) return cachedValue.concat(formattedStops);

    // not in cache
    const options = {
      ...Constants.GET_OPTIONS,
      url: 'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      qs: {
        input: query,
        key: process.env.PLACES_KEY,
        location: GOOGLE_PLACE_LOCATION,
        radius: 24140,
        strictbounds: '',
      },
    };

    const autocompleteRequest = await RequestUtils.createRequest(options, 'Autocomplete request failed');

    if (autocompleteRequest) {
      const autocompleteResult = JSON.parse(autocompleteRequest);

      const { predictions } = autocompleteResult;

      const googlePredictions = await Promise.all(predictions.map(async (p): Promise<Object> => {
        const placeIDCoords = await getCoordsForPlaceID(p.place_id);
        return {
          type: GOOGLE_PLACE,
          detail: p.structured_formatting.secondary_text,
          name: p.structured_formatting.main_text,
          placeID: p.place_id,
          lat: placeIDCoords.lat,
          long: placeIDCoords.long,
        };
      }));

      if (googlePredictions) {
        const filteredPredictions = getFilteredPredictions(googlePredictions, formattedStops);
        queryToPredictionsCache.set(query, filteredPredictions);
        return filteredPredictions.concat(formattedStops);
      }
    }
    return [];
  }
}

async function getCoordsForPlaceID(placeID: String): Object {
  const cachedValue = placeIDToCoordsCache.get(placeID);
  // Return an object of lat and long
  if (cachedValue) return cachedValue;

  // place id is not in cache so we must get lat and long
  const options = {
    ...Constants.GET_OPTIONS,
    url: 'https://maps.googleapis.com/maps/api/place/details/json',
    qs: {
      placeid: placeID,
      key: process.env.PLACES_KEY,
    },
  };

  const placeIDDetailsRequest = await RequestUtils.createRequest(options, 'Place ID Details request failed');

  if (placeIDDetailsRequest) {
    const placeIDDetailsResult = JSON.parse(placeIDDetailsRequest);
    const placeIDCoords = {
      lat: placeIDDetailsResult.result.geometry.location.lat,
      long: placeIDDetailsResult.result.geometry.location.lng,
    };

    placeIDToCoordsCache.set(placeID, placeIDCoords);
    return placeIDCoords;
  }
  return {
    lat: null,
    long: null,
  };
}

/**
 * Returns an array of googlePredictions that are not bus stops.
 * @param googlePredictions
 * @param busStops
 * @returns {Array<Object>}
 */
function getFilteredPredictions(
  googlePredictions: Array<Object>,
  busStops: Array<Object>,
): Array<Object> {
  return googlePredictions.filter((p) => {
    const stopsThatArePlaces = busStops.find(s => p.name.includes(s.name));
    return stopsThatArePlaces === undefined;
  });
}

export default new SearchRouter().router;
