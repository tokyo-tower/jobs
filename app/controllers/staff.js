"use strict";
/**
 * 内部関係者タスクコントローラー
 *
 * @namespace StaffController
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
const chevre_domain_2 = require("@motionpicture/chevre-domain");
const crypto = require("crypto");
const createDebug = require("debug");
const fs = require("fs-extra");
const debug = createDebug('chevre-jobs:controller:staff');
/**
 *
 * @memberOf StaffController
 */
function createFromJson() {
    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/staffs.json`, 'utf8', (err, data) => __awaiter(this, void 0, void 0, function* () {
        if (err instanceof Error) {
            throw err;
        }
        const staffs = JSON.parse(data);
        // あれば更新、なければ追加
        const promises = staffs.map((staff) => __awaiter(this, void 0, void 0, function* () {
            // パスワードハッシュ化
            const SIZE = 64;
            const passwordSalt = crypto.randomBytes(SIZE).toString('hex');
            staff.password_salt = passwordSalt;
            staff.password_hash = chevre_domain_1.CommonUtil.createHash(staff.password, passwordSalt);
            debug('updating staff...');
            yield chevre_domain_1.Models.Staff.findOneAndUpdate({
                user_id: staff.user_id
            }, staff, {
                new: true,
                upsert: true
            }).exec();
            debug('staff updated');
        }));
        yield Promise.all(promises);
        debug('promised.');
    }));
}
exports.createFromJson = createFromJson;
/**
 * スクリーン指定で内部関係者の先抑えを実行する
 *
 * @memberOf StaffController
 */
function createReservationsFromJson() {
    // スクリーンごとに内部予約を追加する
    chevre_domain_1.Models.Screen.distinct('_id', (err, screenIds) => {
        if (err !== null) {
            debug('screen ids found.', err);
            return;
        }
        let i = 0;
        const next = () => {
            if (i < screenIds.length) {
                debug('createStaffReservationsByScreenId processing...', screenIds[i].toString());
                createReservationsByScreenId(screenIds[i].toString(), (createErr) => {
                    debug('createStaffReservationsByScreenId processed.', createErr);
                    i += 1;
                    next();
                });
            }
            else {
                debug('end.');
            }
        };
        next();
    });
}
exports.createReservationsFromJson = createReservationsFromJson;
// tslint:disable-next-line:max-func-body-length
function createReservationsByScreenId(screenId, cb) {
    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/staffReservations_${screenId}.json`, 'utf8', (err, data) => __awaiter(this, void 0, void 0, function* () {
        if (err instanceof Error) {
            debug('no reservations.');
            cb(null);
            return;
        }
        // 内部関係者をすべて取得
        const staffs = yield chevre_domain_1.Models.Staff.find({}).exec();
        const staffsByName = {};
        for (const staff of staffs) {
            staffsByName[staff.get('name')] = staff;
        }
        let reservations = [];
        // スクリーンのパフォーマンスをすべて取得
        const performances = yield chevre_domain_1.Models.Performance.find({ screen: screenId })
            .populate('film', 'name is_mx4d copyright')
            .populate('screen', 'name')
            .populate('theater', 'name address')
            .exec();
        for (const performance of performances) {
            const paymentNo = yield chevre_domain_2.ReservationUtil.publishPaymentNo(performance.get('day'));
            let reservationsByPerformance = JSON.parse(data);
            reservationsByPerformance = reservationsByPerformance.map((reservation, index) => {
                const staffOfReservation = staffsByName[reservation.staff_name];
                return {
                    performance: performance.get('_id'),
                    seat_code: reservation.seat_code,
                    status: chevre_domain_2.ReservationUtil.STATUS_RESERVED,
                    staff: staffOfReservation.get('_id'),
                    staff_user_id: staffOfReservation.get('user_id'),
                    staff_email: staffOfReservation.get('email'),
                    staff_name: staffOfReservation.get('name'),
                    staff_signature: 'system',
                    entered: false,
                    updated_user: 'system',
                    purchased_at: Date.now(),
                    watcher_name_updated_at: Date.now(),
                    watcher_name: '',
                    film_copyright: performance.get('film').get('copyright'),
                    film_is_mx4d: performance.get('film').get('is_mx4d'),
                    film_image: `${process.env.FRONTEND_ENDPOINT}/images/film/${performance.get('film').get('_id')}.jpg`,
                    film_name_en: performance.get('film').get('name.en'),
                    film_name_ja: performance.get('film').get('name.ja'),
                    film: performance.get('film').get('_id'),
                    screen_name_en: performance.get('screen').get('name.en'),
                    screen_name_ja: performance.get('screen').get('name.ja'),
                    screen: performance.get('screen').get('_id'),
                    theater_name_en: performance.get('theater').get('name.en'),
                    theater_name_ja: performance.get('theater').get('name.ja'),
                    theater_address_en: performance.get('theater').get('address.en'),
                    theater_address_ja: performance.get('theater').get('address.ja'),
                    theater: performance.get('theater').get('_id'),
                    performance_canceled: performance.get('canceled'),
                    performance_end_time: performance.get('end_time'),
                    performance_start_time: performance.get('start_time'),
                    performance_open_time: performance.get('open_time'),
                    performance_day: performance.get('day'),
                    purchaser_group: chevre_domain_2.ReservationUtil.PURCHASER_GROUP_STAFF,
                    payment_no: paymentNo,
                    payment_seat_index: index,
                    charge: 0,
                    ticket_type_charge: 0,
                    ticket_type_name_en: 'Free',
                    ticket_type_name_ja: '無料',
                    seat_grade_additional_charge: 0,
                    seat_grade_name_en: 'Normal Seat',
                    seat_grade_name_ja: 'ノーマルシート'
                };
            });
            reservations = reservations.concat(reservationsByPerformance);
        }
        debug('creating staff reservations...length:', reservations.length);
        let insertManyError = null;
        try {
            yield chevre_domain_1.Models.Reservation.insertMany(reservations);
        }
        catch (error) {
            insertManyError = error;
        }
        debug('staff reservations created.');
        cb(insertManyError);
    }));
}
