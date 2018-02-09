/**
 * パフォーマンスに対する集計データを更新する
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as moment from 'moment';
// tslint:disable-next-line:no-require-imports no-var-requires
require('moment-timezone');

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

// tslint:disable-next-line:no-magic-numbers
const PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS = parseInt(<string>process.env.PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS, 10);
// tslint:disable-next-line:no-magic-numbers
const PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS = parseInt(<string>process.env.PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS, 10);

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
const redisClient = ttts.redis.createClient({
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(<string>process.env.REDIS_PORT, 10),
    host: <string>process.env.REDIS_HOST,
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});

// 日本時間で今日の0時
const startFrom = moment(`${moment().tz('Asia/Tokyo').format('YYYY-MM-DD')}T00:00:00+09:00`);
// startFromからPERFORMANCE_AGGREGATE_THROUGH_IN_DAYS後
const startThrough = moment(startFrom).add(PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS, 'days');
ttts.service.performance.aggregateCounts(
    {
        startFrom: startFrom.toDate(),
        startThrough: startThrough.toDate()
    },
    PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS
)(
    new ttts.repository.place.CheckinGate(redisClient),
    new ttts.repository.Performance(ttts.mongoose.connection),
    new ttts.repository.Reservation(ttts.mongoose.connection),
    new ttts.repository.itemAvailability.Performance(redisClient),
    new ttts.repository.itemAvailability.SeatReservationOffer(redisClient),
    new ttts.repository.PerformanceWithAggregation(redisClient),
    new ttts.repository.offer.ExhibitionEvent(redisClient)
    )
    .catch((err) => {
        console.error(err);
    })
    .then(async () => {
        ttts.mongoose.disconnect();
        redisClient.quit();
    });
