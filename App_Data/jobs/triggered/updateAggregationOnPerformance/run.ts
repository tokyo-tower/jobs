/**
 * パフォーマンスに対する集計データを更新する
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as moment from 'moment';

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

ttts.service.performance.aggregateCounts(
    {
        startFrom: moment().toDate(),
        startThrough: moment().add(PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS, 'days').toDate()
    },
    PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS
)(
    new ttts.repository.Performance(ttts.mongoose.connection),
    new ttts.repository.Reservation(ttts.mongoose.connection),
    new ttts.repository.Owner(ttts.mongoose.connection),
    new ttts.repository.PerformanceWithAggregation(redisClient)
    )
    .catch((err) => {
        console.error(err);
    })
    .then(async () => {
        ttts.mongoose.disconnect();
        redisClient.quit();
    });
