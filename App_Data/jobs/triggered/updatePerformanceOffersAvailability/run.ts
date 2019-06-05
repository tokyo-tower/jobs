/**
 * パフォーマンスに対する供給情報ごとの在庫状況を更新する
 */
import * as ttts from '@motionpicture/ttts-domain';
import * as moment from 'moment';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

const UPDATE_PERFORMANCE_OFFERS_AVAILABILITY_PERIOD_IN_DAYS_STR = process.env.UPDATE_PERFORMANCE_OFFERS_AVAILABILITY_PERIOD_IN_DAYS;
if (UPDATE_PERFORMANCE_OFFERS_AVAILABILITY_PERIOD_IN_DAYS_STR === undefined) {
    throw new Error('process.env.UPDATE_PERFORMANCE_OFFERS_AVAILABILITY_PERIOD_IN_DAYS undefined.');
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
const startThrough = moment(startFrom).add(parseInt(UPDATE_PERFORMANCE_OFFERS_AVAILABILITY_PERIOD_IN_DAYS_STR, 10) + 1, 'days').toDate();
ttts.service.itemAvailability.updatePerformanceOffersAvailability({
    startFrom: startFrom,
    startThrough: startThrough
})(
    new ttts.repository.Stock(redisClient),
    new ttts.repository.Performance(ttts.mongoose.connection),
    new ttts.repository.itemAvailability.SeatReservationOffer(redisClient),
    new ttts.repository.rateLimit.TicketTypeCategory(redisClient)
)
    .catch((err) => {
        // tslint:disable-next-line:no-console
        console.error(err);
    })
    .then(async () => {
        await ttts.mongoose.disconnect();
        redisClient.quit();
    });
