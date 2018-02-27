"use strict";
/**
 * パフォーマンスに対する供給情報ごとの在庫状況を更新する
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
ttts.service.itemAvailability.updatePerformanceOffersAvailability()(new ttts.repository.Stock(ttts.mongoose.connection), new ttts.repository.Performance(ttts.mongoose.connection), new ttts.repository.itemAvailability.SeatReservationOffer(redisClient), new ttts.repository.rateLimit.TicketTypeCategory(redisClient))
    .catch((err) => {
    console.error(err);
})
    .then(() => {
    ttts.mongoose.disconnect();
    redisClient.quit();
});
