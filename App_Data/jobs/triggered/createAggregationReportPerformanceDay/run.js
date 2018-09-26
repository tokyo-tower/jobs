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
 * staffの販売停止一覧で返金処理の処理実行
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
});
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        //process.argv.push('20180901,20180902');
        let performanceDays = [];
        if (process.argv.length === 3) {
            performanceDays = process.argv[2].split(',').map((key) => {
                return moment(key, 'YYYYMMDD').format('YYYY/MM/DD');
            });
        }
        else {
            const suspensionRepo = new ttts.repository.itemAvailability.Suspension(redisClient);
            const keysPerformance = yield suspensionRepo.findKeys();
            performanceDays = keysPerformance.map((key) => {
                return moment(key.replace(/performanceDay/gi, ''), 'YYYYMMDD').format('YYYY/MM/DD');
            });
        }
        for (const performanceDay of performanceDays) {
            console.log(`byEndDate:${performanceDay}`);
            try {
                yield ttts.service.aggregate.report4sales.aggregateSalesByEndDate(performanceDay)(new ttts.repository.Reservation(ttts.mongoose.connection), new ttts.repository.Transaction(ttts.mongoose.connection), new ttts.repository.AggregateSale(ttts.mongoose.connection));
            }
            catch (error) {
                console.log(`error byEndDate:${performanceDay}`);
            }
            console.log(`byEventStartDate:${performanceDay}`);
            try {
                yield ttts.service.aggregate.report4sales.aggregateSalesByEventStartDate(performanceDay)(new ttts.repository.Reservation(ttts.mongoose.connection), new ttts.repository.Transaction(ttts.mongoose.connection), new ttts.repository.AggregateSale(ttts.mongoose.connection));
            }
            catch (error) {
                console.log(`error byEventStartDate:${performanceDay}`);
            }
            if (process.argv.length !== 3) {
                const suspensionRepo = new ttts.repository.itemAvailability.Suspension(redisClient);
                yield suspensionRepo.deleteKey(moment(performanceDay, 'YYYY/MM/DD').format('YYYYMMDD'));
            }
            console.log(`${performanceDay} Completed!`);
        }
    });
}
