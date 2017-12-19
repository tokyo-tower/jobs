"use strict";
/**
 * パフォーマンスタスクコントローラー
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
const ttts = require("@motionpicture/ttts-domain");
const createDebug = require("debug");
const fs = require("fs-extra");
const moment = require("moment");
const debug = createDebug('ttts-jobs:controller:performance');
/**
 * 設定からパフォーマンスデータを作成する
 * @memberof controller/performance
 */
// tslint:disable-next-line:max-func-body-length
function createFromSetting() {
    return __awaiter(this, void 0, void 0, function* () {
        // 作成情報取得
        const setting = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/setting.json`);
        debug('setting:', setting);
        // 引数情報取得
        const targetInfo = getTargetInfoForCreateFromSetting(setting.performance_duration, setting.no_performance_times);
        const times = targetInfo.times;
        const days = targetInfo.days;
        debug('targetInfo:', targetInfo);
        // 劇場とスクリーン情報取得
        const screenOfPerformance = yield ttts.Models.Screen.findById(setting.screen)
            .populate('theater')
            .exec();
        debug('screenOfPerformance:', screenOfPerformance);
        if (screenOfPerformance === null) {
            throw new Error('screen not found.');
        }
        // 作品情報取得
        const film = yield ttts.Models.Film.findById({ _id: setting.film }).exec();
        debug('film:', film);
        if (film === null) {
            throw new Error('film not found.');
        }
        // パフォーマンス登録
        const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);
        const savePerformances = [];
        // 7日分Loop
        const promisesDay = (days.map((day) => __awaiter(this, void 0, void 0, function* () {
            // 開始時間分Loop
            const promisesTime = (times.map((time) => __awaiter(this, void 0, void 0, function* () {
                // 2017/10 2次 予約枠、時間の変更対応
                const screen = (setting.special_screens[time.start_time] !== undefined) ?
                    setting.special_screens[time.start_time] : setting.screen;
                // ユニークなIDを生成
                const id = [
                    // tslint:disable-next-line:no-magic-numbers
                    day.slice(-6),
                    setting.film,
                    screen,
                    time.start_time
                ].join('');
                // パフォーマンス登録
                const performance = {
                    id: id,
                    theater: screenOfPerformance.get('theater').get('id'),
                    theater_name: screenOfPerformance.get('theater').get('name'),
                    screen: screen,
                    screen_name: screenOfPerformance.get('name'),
                    film: film.get('id'),
                    ticket_type_group: setting.ticket_type_group,
                    day: day,
                    open_time: time.open_time,
                    start_time: time.start_time,
                    end_time: time.end_time,
                    canceled: false,
                    ttts_extension: {
                        tour_number: time.tour_number,
                        ev_service_status: ttts.factory.performance.EvServiceStatus.Normal,
                        ev_service_update_user: '',
                        online_sales_status: ttts.factory.performance.OnlineSalesStatus.Normal,
                        online_sales_update_user: '',
                        refund_status: ttts.factory.performance.RefundStatus.None,
                        refund_update_user: '',
                        refunded_count: 0
                    }
                };
                debug('creating performance...', performance);
                //スクリーン、作品、上映日、開始時間
                yield performanceRepo.saveIfNotExists(performance);
                savePerformances.push(performance);
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
 * @memberof controller/performance
 */
function getTargetInfoForCreateFromSetting(duration, noPerformanceTimes) {
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
            // パフォーマンスを作成しない時刻に指定されていなかったら作成
            if (noPerformanceTimes.indexOf(startTime) < 0) {
                info.times.push({
                    open_time: startTime,
                    start_time: startTime,
                    end_time: getEndTime(startTime),
                    tour_number: `${hour}${tours[index]}`
                });
            }
            index += 1;
        });
    });
    return info;
}
/**
 *
 *
 * @memberof controller/performance
 */
function createFromJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);
        const performances = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/performances.json`);
        const screens = yield ttts.Models.Screen.find({}, 'name theater').populate('theater', 'name').exec();
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
            yield performanceRepo.performanceModel.create(performance);
            debug('performance created');
        })));
        debug('promised.');
    });
}
exports.createFromJson = createFromJson;
/**
 * ID指定でパフォーマンスを公開する
 *
 * @memberof controller/performance
 */
function release(performanceId) {
    return __awaiter(this, void 0, void 0, function* () {
        const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);
        debug('updating performance..._id:', performanceId);
        yield performanceRepo.performanceModel.findByIdAndUpdate(performanceId, { canceled: false }).exec();
        debug('performance updated');
    });
}
exports.release = release;
