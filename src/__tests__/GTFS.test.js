import 'babel-polyfill';
import TestUtils from '../utils/TestUtils';
import TimeUtils from '../utils/TimeUtils';
import GTFS from '../GTFS';

const currTime = Math.round(1504474540);
const serviceDate = TimeUtils.unixTimeToGTFSDate(currTime);

describe('Testing GTFS', () => {
  it('Times in paths are monotonically nondecreasing', async () => {
    const busData = await GTFS.buses(serviceDate);
    const busArray = busData.buses;
    for (var key in busArray) {
      var bus = busArray[key];
      for (var path in bus.paths) {
        for (var timedStops in path.timedStops) {
          for (let i = 1; i < timedStops.length; i++) {
            console.log(timedStops[i].time)
            if (timedStops[i].time < timedStops[i-1].time) {
              console.log(timeStops);
            }
            expect(timedStops[i].time >= timedStops[i-1].time);
          }
        }
      }
    }


  })


});
