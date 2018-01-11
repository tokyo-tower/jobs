"use strict";
/**
 * 展示イベントの販売情報を更新する
 * @ignore
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ttts = require("@motionpicture/ttts-domain");
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
const redisClient = ttts.redis.createClient({
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(process.env.REDIS_PORT, 10),
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});
ttts.service.offer.updateExhibitionEventOffers(
// tslint:disable-next-line:no-magic-numbers
parseInt(process.env.UPDATE_EVENT_OFFERS_PERIOD_IN_DAYS, 10), 
// tslint:disable-next-line:no-magic-numbers
parseInt(process.env.EVENT_OFFERS_EXPIRES_IN_SECONDS, 10))(new ttts.repository.Performance(ttts.mongoose.connection), new ttts.repository.offer.ExhibitionEvent(redisClient))
    .catch((err) => {
    console.error(err);
})
    .then(() => {
    ttts.mongoose.disconnect();
    redisClient.quit();
});
