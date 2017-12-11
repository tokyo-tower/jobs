"use strict";
/**
 * パフォーマンス在庫状況を更新する
 * @ignore
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ttts = require("@motionpicture/ttts-domain");
const mongooseConnectionOptions_1 = require("../../../../app/mongooseConnectionOptions");
ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
const redisClient = ttts.redis.createClient(
// tslint:disable-next-line:no-magic-numbers
parseInt(process.env.TTTS_PERFORMANCE_STATUSES_REDIS_PORT, 10), process.env.TTTS_PERFORMANCE_STATUSES_REDIS_HOST, {
    password: process.env.TTTS_PERFORMANCE_STATUSES_REDIS_KEY,
    tls: { servername: process.env.TTTS_PERFORMANCE_STATUSES_REDIS_HOST },
    return_buffers: true
});
ttts.service.itemAvailability.updatePerformanceStatuses()(new ttts.repository.Stock(ttts.mongoose.connection), new ttts.repository.Performance(ttts.mongoose.connection), new ttts.repository.PerformanceStatuses(redisClient))
    .catch((err) => {
    console.error(err);
})
    .then(() => {
    ttts.mongoose.disconnect();
    redisClient.quit();
});
