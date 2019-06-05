/**
 * 展示イベントの販売情報を更新する
 */
import * as ttts from '@motionpicture/ttts-domain';
import * as moment from 'moment';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

const UPDATE_EVENT_OFFERS_PERIOD_IN_DAYS_STR = process.env.UPDATE_EVENT_OFFERS_PERIOD_IN_DAYS;
if (UPDATE_EVENT_OFFERS_PERIOD_IN_DAYS_STR === undefined) {
    throw new Error('process.env.UPDATE_EVENT_OFFERS_PERIOD_IN_DAYS undefined.');
}

const EVENT_OFFERS_EXPIRES_IN_SECONDS_STR = process.env.EVENT_OFFERS_EXPIRES_IN_SECONDS;
if (EVENT_OFFERS_EXPIRES_IN_SECONDS_STR === undefined) {
    throw new Error('process.env.EVENT_OFFERS_EXPIRES_IN_SECONDS undefined.');
}

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
const redisClient = ttts.redis.createClient({
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(<string>process.env.REDIS_PORT, 10),
    host: <string>process.env.REDIS_HOST,
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});

// 余裕をもって必要分集計
// tslint:disable-next-line:no-magic-numbers
const startFrom = moment().add(-1, 'week').toDate();
const startThrough = moment(startFrom).add(parseInt(UPDATE_EVENT_OFFERS_PERIOD_IN_DAYS_STR, 10) + 1, 'days').toDate();
ttts.service.offer.updateExhibitionEventOffers({
    startFrom: startFrom,
    startThrough: startThrough,
    ttl: parseInt(EVENT_OFFERS_EXPIRES_IN_SECONDS_STR, 10)
})(
    new ttts.repository.Performance(ttts.mongoose.connection),
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
