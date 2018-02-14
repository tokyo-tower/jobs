"use strict";
/**
 * パフォーマンスに対する集計データを更新する
 * @ignore
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ttts = require("@motionpicture/ttts-domain");
const moment = require("moment");
// tslint:disable-next-line:no-require-imports no-var-requires
require('moment-timezone');
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
// tslint:disable-next-line:no-magic-numbers
const PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS = parseInt(process.env.PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS, 10);
// tslint:disable-next-line:no-magic-numbers
const PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS = parseInt(process.env.PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS, 10);
ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
const redisClient = ttts.redis.createClient({
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(process.env.REDIS_PORT, 10),
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});
// 日本時間で今日の0時
const startFrom = moment(`${moment().tz('Asia/Tokyo').format('YYYY-MM-DD')}T00:00:00+09:00`);
// startFromからPERFORMANCE_AGGREGATE_THROUGH_IN_DAYS後
const startThrough = moment(startFrom).add(PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS, 'days');
ttts.service.performance.aggregateCounts({
    startFrom: startFrom.toDate(),
    startThrough: startThrough.toDate()
}, PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS)(new ttts.repository.place.CheckinGate(redisClient), new ttts.repository.Performance(ttts.mongoose.connection), new ttts.repository.Reservation(ttts.mongoose.connection), new ttts.repository.itemAvailability.Performance(redisClient), new ttts.repository.itemAvailability.SeatReservationOffer(redisClient), new ttts.repository.PerformanceWithAggregation(redisClient), new ttts.repository.offer.ExhibitionEvent(redisClient))
    .catch((err) => {
    console.error(err);
})
    .then(() => __awaiter(this, void 0, void 0, function* () {
    ttts.mongoose.disconnect();
    redisClient.quit();
}));
