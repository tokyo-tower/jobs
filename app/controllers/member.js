"use strict";
/**
 * メルマガ会員タスクコントローラー
 *
 * @namespace MemberController
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
const crypto = require("crypto");
const fs = require("fs-extra");
const log4js = require("log4js");
const mongoose = require("mongoose");
const MONGOLAB_URI = process.env.MONGOLAB_URI;
// todo ログ出力方法考える
log4js.configure({
    appenders: [
        {
            category: 'system',
            type: 'console'
        }
    ],
    levels: {
        system: 'ALL'
    },
    replaceConsole: true
});
const logger = log4js.getLogger('system');
/**
 *
 *
 * @memberOf MemberController
 */
function createFromJson() {
    mongoose.connect(MONGOLAB_URI, {});
    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/members.json`, 'utf8', (err, data) => __awaiter(this, void 0, void 0, function* () {
        if (err instanceof Error) {
            throw err;
        }
        let members = JSON.parse(data);
        // パスワードハッシュ化
        members = members.map((member) => {
            const SIZE = 64;
            const passwordSalt = crypto.randomBytes(SIZE).toString('hex');
            return {
                user_id: member.user_id,
                password_salt: passwordSalt,
                password_hash: chevre_domain_1.CommonUtil.createHash(member.password, passwordSalt)
            };
        });
        logger.info('removing all members...');
        yield chevre_domain_1.Models.Member.remove({}).exec();
        logger.debug('creating members...');
        yield chevre_domain_1.Models.Member.create(members);
        logger.info('members created.');
        mongoose.disconnect();
        process.exit(0);
    }));
}
exports.createFromJson = createFromJson;
/**
 *
 *
 * @memberOf MemberController
 */
function createReservationsFromJson() {
    mongoose.connect(MONGOLAB_URI, {});
    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/memberReservations.json`, 'utf8', (err, data) => __awaiter(this, void 0, void 0, function* () {
        if (err instanceof Error) {
            throw err;
        }
        const reservations = JSON.parse(data);
        logger.debug('creating reservations...');
        const promises = reservations.map((reservationFromJson) => __awaiter(this, void 0, void 0, function* () {
            logger.info('removing reservation...');
            // すでに予約があれば削除してから新規作成
            yield chevre_domain_1.Models.Reservation.remove({
                performance: reservationFromJson.performance,
                seat_code: reservationFromJson.seat_code
            }).exec();
            logger.info('reservation removed.');
            logger.info('creating reservationFromJson...', reservationFromJson);
            yield chevre_domain_1.Models.Reservation.create(reservationFromJson);
            logger.info('reservationFromJson created.');
        }));
        yield Promise.all(promises);
        logger.info('promised.');
        mongoose.disconnect();
        process.exit(0);
    }));
}
exports.createReservationsFromJson = createReservationsFromJson;
