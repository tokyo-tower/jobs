"use strict";
/**
 * create reservations
 * @ignore
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ttts = require("@motionpicture/ttts-domain");
const StockController = require("../../controllers/stock");
const mongooseConnectionOptions_1 = require("../../mongooseConnectionOptions");
ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
// tslint:disable-next-line:no-floating-promises
StockController.createFromSetting()
    .catch((err) => {
    // tslint:disable-next-line:no-console
    console.error(err);
}).then(() => {
    ttts.mongoose.disconnect();
});
