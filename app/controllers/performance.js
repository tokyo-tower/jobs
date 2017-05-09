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
            // TODO anyで逃げているが、型定義をちゃんとかけばもっとよく書ける
            const status = performance.getSeatStatus(reservationNumbers[performance.get('_id').toString()]);
            performanceStatusesModel.setStatus(performance._id.toString(), status);
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
