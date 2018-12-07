// @flow
import crypto from 'crypto';
import LRU from 'lru-cache';
import { ParquetSchema } from 'parquetjs';
import LogUtils from './LogUtils';

const routesCalculationsCache = LRU({
    max: 1000, // max 1000 routes in storage
    maxAge: 1000 * 60 * 15, // max age 15 minutes
});

function getUniqueId(numBytes: ?number = 10) {
    return crypto.randomBytes(numBytes).toString('hex');
}

function assignRouteIdsAndCache(routeRes: Object[], schema: ParquetSchema) {
    routeRes.forEach((route) => {
        route.routeId = getUniqueId();
        routesCalculationsCache.set(route.routeId, { route, schema });
    });
}

function selectRoute(routeId: string, uid: ?string) {
    const routeSchema = routesCalculationsCache.get(routeId);
    if (routeSchema) {
        if (uid) {
            routeSchema.route.uid = uid;
        }

        return LogUtils.logToChronicle(
            'routeSelected',
            routeSchema.schema,
            routeSchema.route,
        );
    }
    return false;
}

export default {
    getUniqueId,
    selectRoute,
    assignRouteIdsAndCache,
};