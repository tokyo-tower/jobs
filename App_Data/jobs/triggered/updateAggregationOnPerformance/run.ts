/**
 * パフォーマンスに対する集計データを更新する
 */
import * as ttts from '@motionpicture/ttts-domain';
import * as moment from 'moment-timezone';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

const PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS_STR = process.env.PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS;
if (PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS_STR === undefined) {
    throw new Error('process.env.PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS undefined.');
}

const PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS_STR = process.env.PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS;
if (PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS_STR === undefined) {
    throw new Error('process.env.PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS undefined.');
}

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
const redisClient = ttts.redis.createClient({
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(<string>process.env.REDIS_PORT, 10),
    host: <string>process.env.REDIS_HOST,
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});

// 余裕をもって必要分集計するために、24時間前から集計
const startFrom = moment().add(-1, 'day').toDate();
const startThrough = moment(startFrom).add(parseInt(PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS_STR, 10) + 1, 'days').toDate();
ttts.service.performance.aggregateCounts(
    {
        startFrom: startFrom,
        startThrough: startThrough
    },
    parseInt(PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS_STR, 10)
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
        // tslint:disable-next-line:no-console
        console.error(err);
    })
    .then(async () => {
        await ttts.mongoose.disconnect();
        redisClient.quit();
    });
