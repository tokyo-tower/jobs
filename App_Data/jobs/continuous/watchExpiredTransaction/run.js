"use strict";
/**
 * 期限切れ取引監視
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
const ttts = require("@tokyotower/domain");
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
let countExecute = 0;
const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
const INTERVAL_MILLISECONDS = 200;
const taskRepo = new ttts.repository.Task(ttts.mongoose.connection);
const transactionRepo = new ttts.repository.Transaction(ttts.mongoose.connection);
setInterval(() => __awaiter(this, void 0, void 0, function* () {
    if (countExecute > MAX_NUBMER_OF_PARALLEL_TASKS) {
        return;
    }
    countExecute += 1;
    try {
        yield ttts.service.transaction.placeOrder.exportTasks(ttts.factory.transactionStatusType.Expired)(taskRepo, transactionRepo);
    }
    catch (error) {
        console.error(error.message);
    }
    countExecute -= 1;
}), INTERVAL_MILLISECONDS);
