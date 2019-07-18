"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 不要なイベント予約集計を削除する
 */
const ttts = require("@tokyotower/domain");
const moment = require("moment");
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
        const redisClient = ttts.redis.createClient({
            port: Number(process.env.REDIS_PORT),
            host: process.env.REDIS_HOST,
            password: process.env.REDIS_KEY,
            tls: { servername: process.env.REDIS_HOST }
        });
        const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);
        const eventWithAggregationRepo = new ttts.repository.EventWithAggregation(redisClient);
        // 過去のイベントを検索
        const startThrough = moment().add(-1, 'week').toDate();
        const startFrom = moment(startThrough).add(-1, 'week').toDate();
        const eventIds = yield performanceRepo.distinct('_id', {
            startFrom: startFrom,
            startThrough: startThrough
        });
        if (eventIds.length > 0) {
            yield eventWithAggregationRepo.deleteByIds({ ids: eventIds });
        }
        yield ttts.mongoose.disconnect();
        redisClient.quit();
    });
}
main()
    .then()
    .catch((error) => {
    // tslint:disable-next-line:no-console
    console.error(error);
    process.exit(0);
});
