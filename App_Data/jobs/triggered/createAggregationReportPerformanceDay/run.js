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
const kick = require("request");
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
        const suspensionRepo = new ttts.repository.itemAvailability.Suspension(redisClient);
        const keysPerformance = yield suspensionRepo.findKeys();
        const performanceDays = keysPerformance.map((key) => {
            return key.replace(/performanceDay/gi, '');
        }).join(',');
        if (performanceDays) {
            const aggregationUrl = `${process.env.JOBS_ENDPOINT}/api/triggeredwebjobs/createAggregationReport/run?arguments=${performanceDays}`;
            const auth = `Basic ${Buffer.from(`${process.env.JOBS_UID}:${process.env.JOBS_ENCRYPTED_PASSWORD}`).toString('base64')}`;
            const attribute = {
                uri: aggregationUrl,
                headers: { Authorization: auth }
            };
            console.log(`createAggregationReportに${performanceDays}で渡す`);
            yield kick.post(attribute);
        }
    });
}
