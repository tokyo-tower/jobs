"use strict";
/**
 * 座席予約タスクコントローラー
 * @namespace ReservationController
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
const debug = createDebug('ttts-jobs:controller:reservation');
/**
 * 設定指定で座席在庫を作成する
 * @memberof controller/reservation
 */
function createFromSetting() {
    return __awaiter(this, void 0, void 0, function* () {
        // 引数情報取得
        const targetInfo = getTargetInfoForCreateFromSetting();
        const times = targetInfo.startTimes;
        const days = targetInfo.days;
        debug('times days', times, days);
        // 作成情報取得(作品、スクリーン、作成日(引数の日数より)、開始時刻(引数の時刻より))
        // 2017/10 検索条件からスクリーン削除
        // screen: setting.screen,
        const setting = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/setting.json`);
        debug('setting:', setting);
        const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);
        const performances = yield performanceRepo.performanceModel.find({
            film: setting.film,
            day: { $in: days },
            start_time: { $in: times }
        }, '_id start_time screen').exec();
        // 劇場とスクリーン情報取得
        // const screenOfPerformance = await Models.Screen.findById(setting.screen, 'name theater sections')
        //                                    .populate('theater', 'name address')
        //                                    .exec();
        // if (screenOfPerformance === undefined) {
        //     throw new Error('screen not found.');
        // }
        const screenOfPerformances = yield ttts.Models.Screen.find({}, 'name theater sections')
            .populate('theater', 'name address')
            .exec();
        const screens = {};
        screenOfPerformances.map((screen) => {
            const id = screen._id;
            screens[id] = screen;
        });
        debug('screens:', screens);
        const stockRepo = new ttts.repository.Stock(ttts.mongoose.connection);
        // 予約登録・パフォーマンス分Loop
        const promisesR = (performances.map((performance) => __awaiter(this, void 0, void 0, function* () {
            // 2017/10 2次 予約枠、時間の変更対応
            const screen = screens[performance.screen];
            // 座席分Loop
            //const promises = ((<any>screenOfPerformance).get('sections')[0].seats.map(async (seat: any) => {
            const promises = (screen.get('sections')[0].seats.map((seat) => __awaiter(this, void 0, void 0, function* () {
                const stock = {
                    performance: performance._id,
                    seat_code: seat.code,
                    availability: ttts.factory.itemAvailability.InStock
                    // reservation.performance_canceled = false;
                    // reservation.checkins = [];
                };
                debug('creating stock', stock);
                const result = yield stockRepo.stockModel.findOneAndUpdate({
                    performance: stock.performance,
                    seat_code: stock.seat_code
                }, {
                    //なければ作成あれば更新：値は先勝ちで作成
                    //間違って同じ日の予約を流した時、すでに予約に進んでいるデータを壊さないため。
                    //$set: reservation
                    // 新規作成時のみセットしたいカラムは$setOnInsertに設定
                    // 項目が重なっているとエラーになる↓
                    // MongoError: Cannot update 'film' and 'film' at the same time
                    $setOnInsert: stock
                }, {
                    upsert: true,
                    new: true
                }).exec();
                if (result === null) {
                    debug('error.');
                }
                else {
                    debug('ok.');
                }
            })));
            yield Promise.all(promises);
        })));
        yield Promise.all(promisesR);
    });
}
exports.createFromSetting = createFromSetting;
/**
 * パフォーマンス作成・作成対象情報取得
 * @memberof controller/performance
 */
function getTargetInfoForCreateFromSetting() {
    const info = {};
    info.days = [];
    info.startTimes = [];
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
    const hourLength = 2;
    hours.forEach((hour) => {
        // 2桁でない時は'0'詰め
        //hour = (hour.length < hourLength) ? '0' + hour : hour;
        hour = (hour.length < hourLength) ? `0${hour}` : hour;
        minutes.forEach((minute) => {
            info.startTimes.push(hour + minute);
        });
    });
    return info;
}
