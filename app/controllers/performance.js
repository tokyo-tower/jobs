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
const moment = require("moment");
const STATUS_AVAILABLE = 'AVAILABLE';
const DEFAULT_RADIX = 10;
const debug = createDebug('ttts-jobs:controller:performance');
/**
 *
 *
 * @memberOf controller/performance
 */
function createFromSetting() {
    return __awaiter(this, void 0, void 0, function* () {
        // 作成情報取得
        const setting = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/setting.json`);
        // 引数情報取得
        const targetInfo = getTargetInfoForCreateFromSetting(setting.performance_duration);
        const times = targetInfo.times;
        const days = targetInfo.days;
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
        // パフォーマンス登録
        const performance = {};
        const savePerformances = [];
        performance.screen_name = (screenOfPerformance !== null) ? screenOfPerformance.get('name') : '';
        performance.theater_name = (screenOfPerformance !== null) ? screenOfPerformance.get('theater').get('name') : '';
        performance.theater = setting.theater;
        //performance.screen = setting.screen;
        performance.film = setting.film;
        performance.canceled = false;
        performance.ticket_type_group = setting.ticket_type_group;
        // 7日分Loop
        const promisesDay = (days.map((day) => __awaiter(this, void 0, void 0, function* () {
            performance.day = day;
            // 開始時間分Loop
            const promisesTime = (times.map((time) => __awaiter(this, void 0, void 0, function* () {
                // パフォーマンス時間情報セット
                performance.open_time = time.open_time;
                performance.start_time = time.start_time;
                performance.end_time = time.end_time;
                performance.ttts_extension = {
                    tour_number: time.tour_number,
                    ev_service_status: ttts_domain_1.PerformanceUtil.EV_SERVICE_STATUS.NORMAL,
                    ev_service_update_user: '',
                    online_sales_status: ttts_domain_1.PerformanceUtil.ONLINE_SALES_STATUS.NORMAL,
                    online_sales_update_user: ''
                };
                // 2017/10 2次 予約枠、時間の変更対応
                performance.screen =
                    setting.special_screens.hasOwnProperty(performance.start_time) ?
                        setting.special_screens[performance.start_time] : setting.screen;
                // パフォーマンス登録
                debug('creating performance...');
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
                }).exec();
                debug('performance created');
                if (result !== null) {
                    performance._id = result._id;
                    savePerformances.push(result);
                }
            })));
            yield Promise.all(promisesTime);
        })));
        yield Promise.all(promisesDay);
    });
}
exports.createFromSetting = createFromSetting;
/**
 * パフォーマンス作成・作成対象情報取得
 *
 * @memberOf controller/performance
 */
function getTargetInfoForCreateFromSetting(duration) {
    const info = {};
    info.days = [];
    info.times = [];
    // 引数から作成対象時間と作成日数を取得
    const argvLength = 5;
    if (process.argv.length < argvLength) {
        throw new Error('argv \'time\' or \'days\' not found.');
    }
    const indexTargetHours = 2;
    const indexStartDay = 3;
    const indexTargetDays = 4;
    // 作成対象時間: 9,10,11など
    const hours = process.argv[indexTargetHours].split(',');
    // 作成開始が今日から何日後か: 30
    const start = Number(process.argv[indexStartDay]);
    // 何日分作成するか: 7
    const days = Number(process.argv[indexTargetDays]);
    // 本日日付+開始日までの日数から作成開始日セット
    const today = moment().add(start - 1, 'days');
    // 作成日数分の作成対象日付作成
    for (let index = 0; index < days; index = index + 1) {
        const dateWk = today.add(1, 'days').format('YYYYMMDD');
        info.days.push(dateWk);
    }
    const minutes = ['00', '15', '30', '45'];
    const tours = ['1', '2', '3', '4'];
    const hourLength = 2;
    // 終了時刻取得
    const getEndTime = (startTime) => {
        const startMoment = moment(startTime, 'HHmm');
        return moment(startMoment.add(duration, 'minutes'), 'HHmm').format('HHmm');
    };
    hours.forEach((hour) => {
        // 2桁でない時は'0'詰め
        hour = (hour.length < hourLength) ? `0${hour}` : hour;
        let index = 0;
        minutes.forEach((minute) => {
            const startTime = hour + minute;
            info.times.push({
                open_time: startTime,
                start_time: startTime,
                end_time: getEndTime(startTime),
                tour_number: `${hour}${tours[index]}`
            });
            index += 1;
        });
    });
    return info;
}
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
                $match: {
                    status: STATUS_AVAILABLE
                }
            },
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
            // 空席ステータス変更(空席数("予約可能"な予約データ数)をそのままセット)
            //const status = (<any>performance).getSeatStatus(reservationNumbers[performance.get('_id').toString()]);
            //performanceStatusesModel.setStatus(performance._id.toString(), status);
            const reservationNumber = reservationNumbers[performance.get('_id')];
            //const availableSeatNum = (<any>performance).screen.seats_number - reservationNumber;
            //performanceStatusesModel.setStatus(performance._id.toString(), availableSeatNum.toString());
            performanceStatusesModel.setStatus(performance._id.toString(), reservationNumber.toString());
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
