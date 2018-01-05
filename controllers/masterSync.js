"use strict";
/**
 * マスター同期コントローラー
 * @namespace controllers.masterSync
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
const createDebug = require("debug");
const fs = require("fs-extra");
const debug = createDebug('ttts-jobs:controllers:masterSync');
/**
 * jsonから作品生成
 */
function createFilmsFromJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const films = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/films.json`);
        yield Promise.all(films.map((film) => __awaiter(this, void 0, void 0, function* () {
            debug('updating film...');
            yield ttts.Models.Film.findByIdAndUpdate(film._id, film, {
                new: true,
                upsert: true
            }).exec();
            debug('film updated');
        })));
        debug('promised.');
    });
}
exports.createFilmsFromJson = createFilmsFromJson;
/**
 * jsonからスクリーン生成
 */
function createScreensFromJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const screens = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/screens.json`);
        yield Promise.all(screens.map((screen) => __awaiter(this, void 0, void 0, function* () {
            // 座席数情報を追加
            screen.seats_number = screen.sections[0].seats.length;
            // 座席グレードごとの座席数情報を追加
            const seatsNumbersBySeatCode = {};
            seatsNumbersBySeatCode[ttts.factory.place.movieTheater.SeatGrade.Normal] = 0;
            seatsNumbersBySeatCode[ttts.factory.place.movieTheater.SeatGrade.PremiereBox] = 0;
            seatsNumbersBySeatCode[ttts.factory.place.movieTheater.SeatGrade.PremiereLuxury] = 0;
            seatsNumbersBySeatCode[ttts.factory.place.movieTheater.SeatGrade.FrontReclining] = 0;
            screen.sections[0].seats.forEach((seat) => {
                seatsNumbersBySeatCode[seat.grade.code] += 1;
            });
            screen.seats_numbers_by_seat_grade = Object.keys(seatsNumbersBySeatCode).map((seatGradeCode) => {
                return {
                    seat_grade_code: seatGradeCode,
                    seats_number: seatsNumbersBySeatCode[seatGradeCode]
                };
            });
            debug('updating screen...');
            yield ttts.Models.Screen.findByIdAndUpdate(screen._id, screen, {
                new: true,
                upsert: true
            }).exec();
            debug('screen updated');
        })));
        debug('promised.');
    });
}
exports.createScreensFromJson = createScreensFromJson;
/**
 * jsonから劇場生成
 */
function createTheatersFromJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const theaters = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/theaters.json`);
        yield Promise.all(theaters.map((theater) => __awaiter(this, void 0, void 0, function* () {
            debug('updating theater...');
            yield ttts.Models.Theater.findByIdAndUpdate(theater._id, theater, {
                new: true,
                upsert: true
            }).exec();
            debug('theater updated');
        })));
        debug('promised.');
    });
}
exports.createTheatersFromJson = createTheatersFromJson;
/**
 * jsonから券種生成
 */
function createTicketTypesFromJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const ticketTypes = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypes.json`);
        yield Promise.all(ticketTypes.map((ticketType) => __awaiter(this, void 0, void 0, function* () {
            debug('updating ticketType...');
            yield ttts.Models.TicketType.findByIdAndUpdate(ticketType._id, ticketType, {
                new: true,
                upsert: true
            }).exec();
            debug('ticketType updated');
        })));
        debug('promised.');
    });
}
exports.createTicketTypesFromJson = createTicketTypesFromJson;
/**
 * jsonから券種グループ生成
 */
function createTicketTypeGroupsFromJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const ticketTypeGroups = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypeGroups.json`);
        yield Promise.all(ticketTypeGroups.map((ticketTypeGroup) => __awaiter(this, void 0, void 0, function* () {
            debug('updating ticketTypeGroup...');
            yield ttts.Models.TicketTypeGroup.findByIdAndUpdate(ticketTypeGroup._id, ticketTypeGroup, {
                new: true,
                upsert: true
            }).exec();
            debug('ticketTypeGroup updated');
        })));
        debug('promised.');
    });
}
exports.createTicketTypeGroupsFromJson = createTicketTypeGroupsFromJson;
