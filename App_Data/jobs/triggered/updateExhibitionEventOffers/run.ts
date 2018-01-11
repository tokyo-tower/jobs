/**
 * 展示イベントの販売情報を更新する
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
const redisClient = ttts.redis.createClient({
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(<string>process.env.REDIS_PORT, 10),
    host: <string>process.env.REDIS_HOST,
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});

ttts.service.offer.updateExhibitionEventOffers(
    // tslint:disable-next-line:no-magic-numbers
    parseInt(<string>process.env.UPDATE_EVENT_OFFERS_PERIOD_IN_DAYS, 10),
    // tslint:disable-next-line:no-magic-numbers
    parseInt(<string>process.env.EVENT_OFFERS_EXPIRES_IN_SECONDS, 10)
)(
    new ttts.repository.Performance(ttts.mongoose.connection),
    new ttts.repository.offer.ExhibitionEvent(redisClient)
    )
    .catch((err) => {
        console.error(err);
    })
    .then(() => {
        ttts.mongoose.disconnect();
        redisClient.quit();
    });
