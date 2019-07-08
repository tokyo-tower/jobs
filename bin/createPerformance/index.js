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
 * Chevreを使用しない場合のパフォーマンス作成
 */
const ttts = require("@motionpicture/ttts-domain");
const performanceController = require("../../controllers/performance");
const mongooseConnectionOptions_1 = require("../../mongooseConnectionOptions");
const USE_CHEVRE = process.env.USE_CHEVRE === '1';
if (!USE_CHEVRE) {
    ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default)
        .then()
        // tslint:disable-next-line:no-console
        .catch(console.error);
    // tslint:disable-next-line:no-floating-promises
    performanceController.createFromSetting()
        .catch((err) => {
        // tslint:disable-next-line:no-console
        console.error(err);
    }).then(() => __awaiter(this, void 0, void 0, function* () {
        yield ttts.mongoose.disconnect();
    }));
}
