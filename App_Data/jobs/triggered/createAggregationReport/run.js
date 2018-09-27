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
 * 売上レポートに対する集計データを更新する
 * @ignore
 */
/* tslint:disable:no-console */
/* tslint:disable:no-magic-numbers */
const ttts = require("@motionpicture/ttts-domain");
const moment = require("moment-timezone");
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
const redisClient = ttts.redis.createClient({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10),
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});
main().then(() => {
    ttts.mongoose.disconnect();
    redisClient.quit();
});
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // 前日を集計する。UTC時間と日本時間に注意！！
        // 日本時間の深夜にバッチを起動するということは、UTC時間だとまだ日付が変わってない。
        // const targetDate = moment().add('day', -1).format('YYYY/MM/DD');
        let targetDates = [];
        if (process.argv.length === 3) {
            targetDates = process.argv[2].split(',').map((key) => {
                return moment(key, 'YYYYMMDD').format('YYYY/MM/DD');
            });
        }
        else {
            targetDates = [moment().format('YYYY/MM/DD')];
        }
        for (const targetDate of targetDates) {
            console.log(`byEndDate:${targetDate}`);
            try {
                yield ttts.service.aggregate.report4sales.aggregateSalesByEndDate(targetDate)(new ttts.repository.Reservation(ttts.mongoose.connection), new ttts.repository.Transaction(ttts.mongoose.connection), new ttts.repository.AggregateSale(ttts.mongoose.connection));
            }
            catch (error) {
                console.log(`error byEndDate:${targetDate}`);
            }
            console.log(`byEventStartDate:${targetDate}`);
            try {
                yield ttts.service.aggregate.report4sales.aggregateSalesByEventStartDate(targetDate)(new ttts.repository.Reservation(ttts.mongoose.connection), new ttts.repository.Transaction(ttts.mongoose.connection), new ttts.repository.AggregateSale(ttts.mongoose.connection));
            }
            catch (error) {
                console.log(`error byEventStartDate:${targetDate}`);
            }
            const suspensionRepo = new ttts.repository.itemAvailability.Suspension(redisClient);
            yield suspensionRepo.deleteKey(moment(targetDate, 'YYYY/MM/DD').format('YYYYMMDD'));
            console.log(`${targetDate} Completed!`);
        }
    });
}
