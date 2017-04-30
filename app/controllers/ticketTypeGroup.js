"use strict";
/**
 * 券種グループタスクコントローラー
 *
 * @namespace controller/ticketTypeGroup
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
const debug = createDebug('chevre-jobs:controller:ticketTypeGroup');
/**
 * @memberOf controller/ticketTypeGroup
 */
function createFromJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const ticketTypeGroups = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypeGroups.json`);
        yield Promise.all(ticketTypeGroups.map((ticketTypeGroup) => __awaiter(this, void 0, void 0, function* () {
            debug('updating ticketTypeGroup...');
            yield chevre_domain_1.Models.TicketTypeGroup.findByIdAndUpdate(ticketTypeGroup._id, ticketTypeGroup, {
                new: true,
                upsert: true
            }).exec();
            debug('ticketTypeGroup updated');
        })));
        debug('promised.');
    });
}
exports.createFromJson = createFromJson;
