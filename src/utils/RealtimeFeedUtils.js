// @flow
import { PYTHON_APP } from './EnvUtils';
import Constants from './Constants';
import LogUtils from './LogUtils';
import RequestUtils from './RequestUtils';

async function fetchRTF(): Object {
  const options = {
    ...Constants.GET_OPTIONS,
    url: `http://${PYTHON_APP || 'localhost'}:5000/rtf`,
  };
  const data = await RequestUtils.createRequest(options, 'RTF request failed');
  return JSON.parse(data);
}

async function fetchVehicles(): Object {
  const options = {
    ...Constants.GET_OPTIONS,
    url: `http://${PYTHON_APP || 'localhost'}:5000/vehicles`,
  };
  const data = await RequestUtils.createRequest(options, 'Vehicles request failed');
  return JSON.parse(data);
}

/**
 * We want to format the old data:
 * [
 *  {
 *   "stopID": "523",
 *   "routeID": "15",
 *   "tripIdentifiers": ["t607-b29-s1C"]
 *  },
 *  ...
 * ]
 * into the new data format type:
 * [
 *  {
 *   "routeNumber" : Integer,
 *   "tripID" : String
 *  },
 *  ...
 * ]
 * @param {*} requestData
 */
function formatOldRequestData(requestData: Object): Object {
  console.log('THIS IS THE REQUEST', requestData);
  if (requestData == null || !('tripIdentifiers' in requestData[0])) {
    console.log('um');
    return requestData;
  }
  const formattedData = requestData.map((data) => {
    const { routeID } = data;
    const { tripIdentifiers } = data;
    const test = tripIdentifiers.map(tripID => ({ routeID, tripID }));
    return test;
  });
  console.log('THIS IS formattedData INFO', formattedData);
  const merged = Array.prototype.concat.apply([], formattedData);
  return merged;
}

/**
 * Given an array of { routeID, tripID },
 * Return bus information
 * Input:
 [
 {
   routeNumber : Integer,
   tripID : String
 },
 …
 ]
 */
async function getTrackingResponse(requestData: Object): Object {
  const formattedData = formatOldRequestData(requestData);
  LogUtils.log({ message: 'getTrackingResponse: entering function' });
  const vehicles = await fetchVehicles();

  const trackingInformation = formattedData.map((data) => {
    let { routeID } = data;
    routeID = Number(routeID);
    const { tripID } = data;
    const vehicleData = getVehicleInformation(routeID, tripID, vehicles);
    if (!vehicleData) {
      LogUtils.log({ message: 'getVehicleResponse: noData', vehicleData });
      return null;
    }
    return vehicleData;
  }).filter(Boolean);

  return trackingInformation;
}

/**
 * Returns a { vehicleID, delay } object
 * @param stopID
 * @param tripID
 * @param rtf
 * @returns Object
 */
function getDelayInformation(
  stopID: ?String,
  tripID: ?String,
  rtf: ?Object,
): ?Object {
  // rtf param ensures the realtimeFeed doesn't update in the middle of execution
  // if invalid params or the trip is inactive
  if (!stopID
    || !tripID
    || !rtf
    || rtf === {}
    || !rtf[tripID]) {
    LogUtils.log({
      category: 'getDelayInformation NULL',
      stopID,
      tripID,
    });
    return null;
  }

  const info = rtf[tripID];
  let delay = parseInt(info.stopUpdates && info.stopUpdates[stopID]);
  if (Number.isNaN(delay)) delay = parseInt(info.delay);

  return {
    delay,
    vehicleId: parseInt(info.vehicleId),
  };
}

function getVehicleInformation(
  routeID: ?Number,
  tripID: ?String,
  vehicles: ?Object,
): ?Object {
  // vehicles param ensures the vehicle tracking information doesn't update in
  // the middle of execution
  if (!routeID
    || !tripID
    || !vehicles
    || vehicles === {}) {
    LogUtils.log({
      category: 'getVehicleInformation NULL',
      routeID,
      tripID,
    });
    return null;
  }

  console.log('vehicles', vehicles);
  const vehicleData = Object.values(vehicles).find(
    v => (Number(v.routeID) === routeID) && (v.tripID === tripID),
    // v.routeID === routeID && v.tripID === tripID,
  );
  console.log('vehicledata', vehicleData);
  if (!vehicleData) {
    LogUtils.log({
      category: 'getVehicleInformation no data',
      routeID,
      tripID,
    });
    return {
      dataType: 'noData',
      delay: 0,
      destination: '',
      deviation: 0,
      direction: '',
      displayStatus: '',
      gpsStatus: 0,
      heading: 0,
      lastStop: '',
      lastUpdated: 0,
      latitude: 0,
      longitude: 0,
      name: '',
      opStatus: '',
      routeID,
      runID: 0,
      speed: 0,
      tripID,
      vehicleID: 0,
      bearing: 0,
      congestionLevel: 0,
    };
  }
  return {
    dataType: 'validData',
    delay: 0,
    destination: '',
    deviation: 0,
    direction: '',
    displayStatus: '',
    gpsStatus: 0,
    heading: 0,
    lastStop: '',
    lastUpdated: vehicleData.timestamp,
    latitude: vehicleData.latitude,
    longitude: vehicleData.longitude,
    name: '',
    opStatus: '',
    routeID,
    runID: 0,
    speed: vehicleData.speed,
    tripID,
    vehicleID: 0,
    bearing: vehicleData.bearing,
    congestionLevel: vehicleData.congestionLevel,
  };
}

export default {
  fetchRTF,
  fetchVehicles,
  getDelayInformation,
  getVehicleInformation,
  getTrackingResponse,
};
