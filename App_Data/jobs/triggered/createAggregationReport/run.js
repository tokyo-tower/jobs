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
 */
const ttts = require("@motionpicture/ttts-domain");
const moment = require("moment-timezone");
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
main().then(() => {
    ttts.mongoose.disconnect();
});
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // 前日を集計する。UTC時間と日本時間に注意！！
        // 日本時間の深夜にバッチを起動するということは、UTC時間だとまだ日付が変わってない。
        // const targetDate = moment().add('day', -1).format('YYYY/MM/DD');
        let targetDate = '';
        // tslint:disable-next-line:no-magic-numbers
        if (process.argv.length === 3) {
            // tslint:disable-next-line:no-magic-numbers
            targetDate = moment(process.argv[2]).format('YYYY/MM/DD');
        }
        else {
            targetDate = moment().format('YYYY/MM/DD');
        }
        try {
            yield ttts.service.aggregate.report4sales.aggregateSalesByEndDate(targetDate)(new ttts.repository.Reservation(ttts.mongoose.connection), new ttts.repository.Transaction(ttts.mongoose.connection), new ttts.repository.AggregateSale(ttts.mongoose.connection));
        }
        catch (error) {
            console.error(`error byEndDate:${targetDate}`);
        }
        try {
            yield ttts.service.aggregate.report4sales.aggregateSalesByEventStartDate(targetDate)(new ttts.repository.Reservation(ttts.mongoose.connection), new ttts.repository.Transaction(ttts.mongoose.connection), new ttts.repository.AggregateSale(ttts.mongoose.connection));
        }
        catch (error) {
            console.error(`error byEventStartDate:${targetDate}`);
        }
    });
}
