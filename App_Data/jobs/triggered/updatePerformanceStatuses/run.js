"use strict";
/**
 * パフォーマンス在庫状況を更新する
 * @ignore
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ttts = require("@motionpicture/ttts-domain");
const performanceController = require("../../../../app/controllers/performance");
const mongooseConnectionOptions_1 = require("../../../../app/mongooseConnectionOptions");
ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
performanceController.updateStatuses()
    .then(() => {
    // no op
}).catch((err) => {
    console.error(err);
}).then(() => {
    ttts.mongoose.disconnect();
    process.exit(0);
});
