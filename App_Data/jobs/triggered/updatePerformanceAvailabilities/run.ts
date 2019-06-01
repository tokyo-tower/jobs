/**
 * パフォーマンス在庫状況を更新する
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as moment from 'moment';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

const UPDATE_PERFORMANCE_AVAILABILITY_PERIOD_IN_DAYS_STR = process.env.UPDATE_PERFORMANCE_AVAILABILITY_PERIOD_IN_DAYS;
if (UPDATE_PERFORMANCE_AVAILABILITY_PERIOD_IN_DAYS_STR === undefined) {
    throw new Error('process.env.UPDATE_PERFORMANCE_AVAILABILITY_PERIOD_IN_DAYS undefined.');
}

const PERFORMANCE_AVAILABILITY_EXPIRES_IN_SECONDS_STR = process.env.PERFORMANCE_AVAILABILITY_EXPIRES_IN_SECONDS;
if (PERFORMANCE_AVAILABILITY_EXPIRES_IN_SECONDS_STR === undefined) {
    throw new Error('process.env.PERFORMANCE_AVAILABILITY_EXPIRES_IN_SECONDS undefined.');
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
const startThrough = moment(startFrom).add(parseInt(UPDATE_PERFORMANCE_AVAILABILITY_PERIOD_IN_DAYS_STR, 10) + 1, 'days').toDate();
ttts.service.itemAvailability.updatePerformanceAvailabilities({
    startFrom: startFrom,
    startThrough: startThrough,
    ttl: parseInt(PERFORMANCE_AVAILABILITY_EXPIRES_IN_SECONDS_STR, 10)
})(
    new ttts.repository.Stock(redisClient),
    new ttts.repository.Performance(ttts.mongoose.connection),
    new ttts.repository.itemAvailability.Performance(redisClient)
)
    .catch((err) => {
        console.error(err);
    })
    .then(() => {
        ttts.mongoose.disconnect();
        redisClient.quit();
    });
