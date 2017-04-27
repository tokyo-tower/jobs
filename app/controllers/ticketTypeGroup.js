"use strict";
/**
 * 券種グループタスクコントローラー
 *
 * @namespace TicketTypeGroupController
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
const chevre_domain_1 = require("@motionpicture/chevre-domain");
const createDebug = require("debug");
const fs = require("fs-extra");
const mongoose = require("mongoose");
const debug = createDebug('chevre-api:task:controller:ticketTypeGroup');
const MONGOLAB_URI = process.env.MONGOLAB_URI;
/**
 * @memberOf FilmController
 */
function createFromJson() {
    mongoose.connect(MONGOLAB_URI, {});
    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypeGroups.json`, 'utf8', (err, data) => __awaiter(this, void 0, void 0, function* () {
        if (err instanceof Error)
            throw err;
        const ticketTypeGroups = JSON.parse(data);
        const promises = ticketTypeGroups.map((ticketTypeGroup) => __awaiter(this, void 0, void 0, function* () {
            debug('updating ticketTypeGroup...');
            yield chevre_domain_1.Models.TicketTypeGroup.findOneAndUpdate({
                _id: ticketTypeGroup._id
            }, ticketTypeGroup, {
                new: true,
                upsert: true
            }).exec();
            debug('ticketTypeGroup updated');
        }));
        yield Promise.all(promises);
        debug('promised.');
        mongoose.disconnect();
        process.exit(0);
    }));
}
exports.createFromJson = createFromJson;
