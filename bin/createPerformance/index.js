"use strict";
/**
 * create performances and reservations
 * @ignore
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ttts = require("@motionpicture/ttts-domain");
const performanceController = require("../../controllers/performance");
const mongooseConnectionOptions_1 = require("../../mongooseConnectionOptions");
ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
// tslint:disable-next-line:no-floating-promises
performanceController.createFromSetting()
    .catch((err) => {
    console.error(err);
}).then(() => {
    ttts.mongoose.disconnect();
});
