"use strict";
/**
 * task name
 *
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
const mongoose = require("mongoose");
const emailQueueController = require("../../app/controllers/emailQueue");
mongoose.connect(process.env.MONGOLAB_URI);
let count = 0;
const INTERVAL_MILLISECONDS = 250;
const MAX_NUMBER_OF_PARALLEL_TASK = 10;
setInterval(() => __awaiter(this, void 0, void 0, function* () {
    if (count > MAX_NUMBER_OF_PARALLEL_TASK) {
        return;
    }
    count += 1;
    try {
        yield emailQueueController.sendOne();
    }
    catch (error) {
        console.error(error);
    }
    count -= 1;
}), INTERVAL_MILLISECONDS);
