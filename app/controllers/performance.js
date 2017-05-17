"use strict";
/**
 * パフォーマンスタスクコントローラー
 *
 * @namespace controller/performance
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
const DEFAULT_RADIX = 10;
const debug = createDebug('ttts-jobs:controller:performance');
/**
 *
 *
 * @memberOf controller/performance
 */
// tslint:disable-next-line:max-func-body-length
function createFromSetting() {
    return __awaiter(this, void 0, void 0, function* () {
        //const setting: any = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/setting.json`);
        const setting = {
            film: '000999',
            day: '20180101',
            theater: '001',
            screen: '00901',
            ticket_type_group: '01'
        };
        // 劇場とスクリーン情報取得
        const screenOfPerformance = yield ttts_domain_1.Models.Screen.findById(setting.screen, 'name theater sections')
            .populate('theater', 'name address')
            .exec();
        if (screenOfPerformance === undefined) {
            throw new Error('screen not found.');
        }
        // 作品情報取得
        const film = yield ttts_domain_1.Models.Film.findById({ _id: setting.film }).exec();
        if (film === undefined) {
            throw new Error('film not found.');
        }
        // 展開する時間をセット
        const hours = ['09', '10', '11', '12', '13', '14'];
        const minutes = ['00', '15', '30', '45'];
        const duration = 14;
        const times = [];
        hours.forEach((hour) => {
            minutes.forEach((minute) => {
                times.push({
                    open_time: hour + minute,
                    start_time: hour + minute,
                    end_time: hour + (Number(minute) + duration).toString()
                });
            });
        });
        // パフォーマンス登録
        const performance = {};
        const performanceIds = [];
        performance.screen_name = screenOfPerformance.get('name');
        performance.theater_name = screenOfPerformance.get('theater').get('name');
        performance.theater = setting.theater;
        performance.screen = setting.screen;
        performance.film = setting.film;
        performance.day = setting.day;
        performance.canceled = false;
        performance.ticket_type_group = setting.ticket_type_group;
        const promises = (times.map((time) => __awaiter(this, void 0, void 0, function* () {
            // パフォーマンス時間情報セット
            performance.open_time = time.open_time;
            performance.start_time = time.start_time;
            performance.end_time = time.end_time;
            // パフォーマンス登録
            debug('creating performance...');
            //const result = await Models.Performance.create(performance);
            //スクリーン、作品、上映日、開始時間
            const result = yield ttts_domain_1.Models.Performance.findOneAndUpdate({
                screen: performance.screen,
                film: performance.film,
                day: performance.day,
                start_time: performance.start_time
            }, {
                // 初回は $setと$setOnInsertがセットされ2回目以降は$setのみセット
                // created_atは更新されない
                $set: performance
                //$setOnInsert: performance
            }, {
                upsert: true,
                new: true
            });
            debug('performance created');
            if (result !== null) {
                performanceIds.push(result._id);
            }
        })));
        yield Promise.all(promises);
        // 予約登録
        const STATUS_AVAILABLE = 'AVAILABLE';
        const promisesR = (performanceIds.map((id) => __awaiter(this, void 0, void 0, function* () {
            const promisesS = (screenOfPerformance.get('sections')[0].seats.map((seat) => __awaiter(this, void 0, void 0, function* () {
                const reservation = {};
                reservation.performance = id;
                reservation.seat_code = seat.code;
                reservation.status = STATUS_AVAILABLE;
                reservation.performance_canceled = false;
                reservation.performance_day = performance.day;
                reservation.performance_open_time = performance.open_time;
                reservation.performance_start_time = performance.start_time;
                reservation.performance_end_time = performance.end_time;
                reservation.theater = performance.theater;
                reservation.theater_name = performance.theater_name;
                reservation.theater_address = screenOfPerformance.get('theater').get('address');
                reservation.screen = performance.screen;
                reservation.screen_name = performance.screen_name;
                reservation.film = performance.film;
                reservation.film_name = film.name;
                //const result = await Models.Reservation.create(reservation);
                const result = yield ttts_domain_1.Models.Reservation.findOneAndUpdate({
                    performance: reservation.performance,
                    seat_code: reservation.seat_code
                }, {
                    //なければ作成あれば更新：値は常にあと勝ちで更新
                    $set: reservation
                    // 新規作成時のみセットしたいカラムは$setOnInsertに設定
                    // 項目が重なっていると、
                    // MongoError: Cannot update 'film' and 'film' at the same time
                    //$setOnInsert: reservation
                }, {
                    upsert: true,
                    new: true
                });
                if (result === null) {
                    debug('error.');
                }
                else {
                    debug('ok.');
                }
            })));
            yield Promise.all(promisesS);
        })));
        yield Promise.all(promisesR);
        debug('promised.');
    });
}
exports.createFromSetting = createFromSetting;
/**
 *
 *
 * @memberOf controller/performance
 */
function createFromJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const performances = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/performances.json`);
        const screens = yield ttts_domain_1.Models.Screen.find({}, 'name theater').populate('theater', 'name').exec();
        // あれば更新、なければ追加
        yield Promise.all(performances.map((performance) => __awaiter(this, void 0, void 0, function* () {
            // 劇場とスクリーン名称を追加
            const screenOfPerformance = screens.find((screen) => {
                return (screen.get('_id').toString() === performance.screen);
            });
            if (screenOfPerformance === undefined) {
                throw new Error('screen not found.');
            }
            performance.screen_name = screenOfPerformance.get('name');
            performance.theater_name = screenOfPerformance.get('theater').get('name');
            debug('creating performance...');
            yield ttts_domain_1.Models.Performance.create(performance);
            debug('performance created');
        })));
        debug('promised.');
    });
}
exports.createFromJson = createFromJson;
/**
 * 空席ステータスを更新する
 *
 * @memberOf controller/performance
 */
function updateStatuses() {
    return __awaiter(this, void 0, void 0, function* () {
        debug('finding performances...');
        const performances = yield ttts_domain_1.Models.Performance.find({}, 'day start_time screen').populate('screen', 'seats_number').exec();
        debug('performances found.');
        const performanceStatusesModel = ttts_domain_1.PerformanceStatusesModel.create();
        debug('aggregating...');
        const results = yield ttts_domain_1.Models.Reservation.aggregate([
            {
                $group: {
                    _id: '$performance',
                    count: { $sum: 1 }
                }
            }
        ]).exec();
        // パフォーマンスIDごとに
        const reservationNumbers = {};
        results.forEach((result) => {
            reservationNumbers[result._id] = parseInt(result.count, DEFAULT_RADIX);
        });
        performances.forEach((performance) => {
            // パフォーマンスごとに空席ステータスを算出する
            if (!reservationNumbers.hasOwnProperty(performance.get('_id').toString())) {
                reservationNumbers[performance.get('_id').toString()] = 0;
            }
            // 空席ステータス変更(空席数をそのままセット)
            // TODO anyで逃げているが、型定義をちゃんとかけばもっとよく書ける
            //const status = (<any>performance).getSeatStatus(reservationNumbers[performance.get('_id').toString()]);
            //performanceStatusesModel.setStatus(performance._id.toString(), status);
            const reservationNumber = reservationNumbers[performance.get('_id')];
            const availableSeatNum = performance.screen.seats_number - reservationNumber;
            performanceStatusesModel.setStatus(performance._id.toString(), availableSeatNum.toString());
            //---
        });
        debug('saving performanceStatusesModel...', performanceStatusesModel);
        yield ttts_domain_1.PerformanceStatusesModel.store(performanceStatusesModel);
        debug('performanceStatusesModel saved.');
    });
}
exports.updateStatuses = updateStatuses;
/**
 * ID指定でパフォーマンスを公開する
 *
 * @memberOf controller/performance
 */
function release(performanceId) {
    return __awaiter(this, void 0, void 0, function* () {
        debug('updating performance..._id:', performanceId);
        yield ttts_domain_1.Models.Performance.findByIdAndUpdate(performanceId, { canceled: false }).exec();
        debug('performance updated');
    });
}
exports.release = release;
