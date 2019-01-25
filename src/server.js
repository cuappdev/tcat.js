// @flow
import dotenv from 'dotenv';
import util from 'util';

import API from './Api';
import AlertsUtils from './utils/AlertsUtils';
import AllStopUtils from './utils/AllStopUtils';
import GhopperUtils from './utils/GraphhopperUtils';
import LogUtils from './utils/LogUtils';
import RealtimeFeedUtils from './utils/RealtimeFeedUtils';
import TokenUtils from './utils/TokenUtils';

dotenv.config(); // dotenv needs to be configured before token fetch
LogUtils.log({ message: 'server.js: Initializing data and waiting for Graphhopper services...' });

const PORT: number = parseInt(process.env.PORT) || 80;
const SERVER_ADDRESS: string = '0.0.0.0';
const TWENTY_SECONDS_IN_MS: number = 20000;

const authToken = TokenUtils.fetchAuthHeader();

const app = new API();
const server = app.getServer(false);
const { express } = app;

/* eslint-disable no-console */
const init = new Promise((resolve, reject) => {
    // start endpoints that rely on external data starting with authentication token
    authToken.then(() => {
        // await data
        const dataInit = Promise.race([
            Promise.all([
                RealtimeFeedUtils.realtimeFeed,
                AllStopUtils.allStops,
                AlertsUtils.alerts,
                TokenUtils.fetchAuthHeader(),
            ]),
            (util.promisify(setTimeout))(TWENTY_SECONDS_IN_MS)
                .then(() => LogUtils.log({ message: 'server.js: Timeout reached' })),
        ]).then(() => {
            LogUtils.log({ message: 'server.js: Initialized data successfully' });
        });

        // await full initialization then listen on the port
        Promise.all([
            dataInit,
            GhopperUtils.isGraphhopperReady,
        ]).then(() => {
            server.listen(PORT, SERVER_ADDRESS, () => {
                LogUtils.log({
                    message: 'server.js: Initialized Graphhopper and all data successfully!\n'
                    + `Transit Backend listening on ${SERVER_ADDRESS}:${PORT}`,
                });
                resolve(PORT);
            });
        });
    });
}).then(value => value).catch((error) => {
    LogUtils.logErr(error, null, 'Transit init failed');
    return null;
});

export { server, init, express };
