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
const moment = require("moment-timezone");
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
const PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS_STR = process.env.PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS;
if (PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS_STR === undefined) {
    throw new Error('process.env.PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS undefined.');
}
const PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS_STR = process.env.PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS;
if (PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS_STR === undefined) {
    throw new Error('process.env.PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS undefined.');
}
ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
const redisClient = ttts.redis.createClient({
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(process.env.REDIS_PORT, 10),
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});
// 余裕をもって必要分集計するために、24時間前から集計
const startFrom = moment().add(-1, 'day').toDate();
const startThrough = moment(startFrom).add(parseInt(PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS_STR, 10) + 1, 'days').toDate();
ttts.service.performance.aggregateCounts({
    startFrom: startFrom,
    startThrough: startThrough
}, parseInt(PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS_STR, 10))(new ttts.repository.place.CheckinGate(redisClient), new ttts.repository.Performance(ttts.mongoose.connection), new ttts.repository.Reservation(ttts.mongoose.connection), new ttts.repository.itemAvailability.Performance(redisClient), new ttts.repository.itemAvailability.SeatReservationOffer(redisClient), new ttts.repository.PerformanceWithAggregation(redisClient), new ttts.repository.offer.ExhibitionEvent(redisClient))
    .catch((err) => {
    console.error(err);
})
    .then(() => __awaiter(this, void 0, void 0, function* () {
    ttts.mongoose.disconnect();
    redisClient.quit();
}));
