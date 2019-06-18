"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * パフォーマンスタスクコントローラー
 */
const ttts = require("@motionpicture/ttts-domain");
const createDebug = require("debug");
const fs = require("fs-extra");
const moment = require("moment-timezone");
const debug = createDebug('ttts-jobs:controller:performance');
/**
 * 設定からパフォーマンスデータを作成する
 */
// tslint:disable-next-line:max-func-body-length
function createFromSetting() {
    return __awaiter(this, void 0, void 0, function* () {
        // 作成情報取得
        const setting = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/setting.json`);
        debug('setting:', setting);
        // 引数情報取得
        const targetInfo = getTargetInfoForCreateFromSetting(setting.performance_duration, setting.no_performance_times);
        debug('targetInfo:', targetInfo);
        // 劇場とスクリーン情報取得
        const theaters = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/theaters.json`);
        const theater = theaters.find((t) => t.id === setting.theater);
        debug('theater:', theater);
        if (theater === undefined) {
            throw new Error('theater not found.');
        }
        const screens = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/screens.json`);
        debug('setting:', setting);
        const screenOfPerformance = screens.find((s) => s.id === setting.screen);
        debug('screenOfPerformance:', screenOfPerformance);
        if (screenOfPerformance === undefined) {
            throw new Error('screen not found.');
        }
        // 作品情報取得
        const films = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/films.json`);
        const film = films.find((f) => f.id === setting.film);
        debug('film:', film);
        if (film === undefined) {
            throw new Error('film not found.');
        }
        // 券種情報取得
        const ticketTypeGroups = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypeGroups.json`);
        const ticketTypeGroup = ticketTypeGroups.find((t) => t.id === setting.ticket_type_group);
        debug('ticketTypeGroup:', ticketTypeGroup);
        if (ticketTypeGroup === undefined) {
            throw new Error('Ticket Type Group not found.');
        }
        // パフォーマンス登録
        const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);
        const savePerformances = [];
        // 7日分Loop
        yield Promise.all(targetInfo.map((performanceInfo) => __awaiter(this, void 0, void 0, function* () {
            // 2017/10 2次 予約枠、時間の変更対応
            const screen = (setting.special_screens[performanceInfo.start_time] !== undefined)
                ? setting.special_screens[performanceInfo.start_time]
                : setting.screen;
            const id = [
                // tslint:disable-next-line:no-magic-numbers
                performanceInfo.day.slice(-6),
                setting.film,
                screen,
                performanceInfo.start_time
            ].join('');
            // パフォーマンス登録
            const performance = Object.assign({ id: id, doorTime: performanceInfo.door_time, startDate: performanceInfo.start_date, endDate: performanceInfo.end_date, duration: performanceInfo.duration, superEvent: film, location: screenOfPerformance, tourNumber: performanceInfo.tour_number, ttts_extension: {
                    tour_number: performanceInfo.tour_number,
                    ev_service_status: ttts.factory.performance.EvServiceStatus.Normal,
                    ev_service_update_user: '',
                    online_sales_status: ttts.factory.performance.OnlineSalesStatus.Normal,
                    online_sales_update_user: '',
                    refund_status: ttts.factory.performance.RefundStatus.None,
                    refund_update_user: '',
                    refunded_count: 0
                }, ticket_type_group: ticketTypeGroup, theater: theater, theater_name: theater.name, screen: screenOfPerformance, screen_name: screenOfPerformance.name, film: film, day: performanceInfo.day, open_time: performanceInfo.start_time, start_time: performanceInfo.start_time, end_time: performanceInfo.end_time, door_time: performanceInfo.door_time, start_date: performanceInfo.start_date, end_date: performanceInfo.end_date, tour_number: performanceInfo.tour_number, additionalProperty: [{ name: 'tourNumber', value: String(performanceInfo.tour_number) }] }, {
                canceled: false
            });
            debug('creating performance...', performance);
            yield performanceRepo.saveIfNotExists(performance);
            savePerformances.push(performance);
            // 集計タスク作成
            const taskRepo = new ttts.repository.Task(ttts.mongoose.connection);
            const aggregateTask = {
                name: ttts.factory.taskName.AggregateEventReservations,
                status: ttts.factory.taskStatus.Ready,
                runsAt: new Date(),
                remainingNumberOfTries: 3,
                // tslint:disable-next-line:no-null-keyword
                lastTriedAt: null,
                numberOfTried: 0,
                executionResults: [],
                data: { id: performance.id }
            };
            yield taskRepo.save(aggregateTask);
        })));
        debug(savePerformances.length, 'performances saved');
    });
}
exports.createFromSetting = createFromSetting;
/**
 * パフォーマンス作成・作成対象情報取得
 */
function getTargetInfoForCreateFromSetting(duration, noPerformanceTimes) {
    const performanceInfos = [];
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
    const minutes = ['00', '15', '30', '45'];
    const tours = ['1', '2', '3', '4'];
    // 本日日付+開始日までの日数から作成開始日セット
    // 作成日数分の作成対象日付作成
    for (let index = 0; index < days; index = index + 1) {
        const now = moment().add(start + index, 'days');
        hours.forEach((hourStr) => {
            // 2桁でない時は'0'詰め
            // tslint:disable-next-line:no-magic-numbers
            const hour = `0${hourStr}`.slice(-2);
            minutes.forEach((minute, minuteIndex) => {
                // ツアー情報作成
                const tourNumber = `${hour}${tours[minuteIndex]}`;
                const startDate = moment(`${now.format('YYYYMMDD')} ${hour}:${minute}:00+09:00`, 'YYYYMMDD HH:mm:ssZ');
                const endDate = moment(startDate).add(duration, 'minutes');
                const day = moment(startDate).tz('Asia/Tokyo').format('YYYYMMDD');
                const startTime = moment(startDate).tz('Asia/Tokyo').format('HHmm');
                const endTime = moment(endDate).tz('Asia/Tokyo').format('HHmm');
                // パフォーマンスを作成しない時刻に指定されていなかったら作成
                if (noPerformanceTimes.indexOf(`${hour}${minute}`) < 0) {
                    performanceInfos.push({
                        day: day,
                        start_time: startTime,
                        end_time: endTime,
                        door_time: startDate.toDate(),
                        start_date: startDate.toDate(),
                        end_date: endDate.toDate(),
                        tour_number: tourNumber,
                        duration: moment.duration(duration, 'minutes').toISOString()
                    });
                }
            });
        });
    }
    return performanceInfos;
}
