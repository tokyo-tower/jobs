"use strict";
/**
 * 作品タスクコントローラー
 *
 * @namespace FilmController
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
const ttts_domain_1 = require("@motionpicture/ttts-domain");
const createDebug = require("debug");
const fs = require("fs-extra");
const debug = createDebug('ttts-jobs:controller:film');
/**
 * @memberOf FilmController
 */
function createTicketTypeGroupsFromJson() {
    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypeGroups.json`, 'utf8', (err, data) => __awaiter(this, void 0, void 0, function* () {
        if (err instanceof Error) {
            throw err;
        }
        const groups = JSON.parse(data);
        debug('removing all groups...');
        yield ttts_domain_1.Models.TicketTypeGroup.remove({}).exec();
        debug('creating groups...');
        yield ttts_domain_1.Models.TicketTypeGroup.create(groups);
        debug('groups created.');
    }));
}
exports.createTicketTypeGroupsFromJson = createTicketTypeGroupsFromJson;
/**
 * @memberOf FilmController
 */
function createFromJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const films = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/films.json`);
        yield Promise.all(films.map((film) => __awaiter(this, void 0, void 0, function* () {
            debug('updating film...');
            yield ttts_domain_1.Models.Film.findByIdAndUpdate(film._id, film, {
                new: true,
                upsert: true
            }).exec();
            debug('film updated');
        })));
        debug('promised.');
    });
}
exports.createFromJson = createFromJson;
