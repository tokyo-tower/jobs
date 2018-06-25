"use strict";
/**
 * 売上レポートに対する集計データを更新する
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
ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
main().then(() => {
    ttts.mongoose.disconnect();
});
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        //  前日を集計する。
        const targetDate = moment().add('day', -1).format('YYYY/MM/DD');
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
    });
}
