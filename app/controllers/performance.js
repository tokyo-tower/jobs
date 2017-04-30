"use strict";
/**
 * パフォーマンスタスクコントローラー
 *
 * @namespace PerformanceController
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
const createDebug = require("debug");
const fs = require("fs-extra");
const mongoose = require("mongoose");
const DEFAULT_RADIX = 10;
const debug = createDebug('chevre-jobs:controller:performance');
/**
 *
 *
 * @memberOf PerformanceController
 */
function createFromJson() {
    mongoose.connect(process.env.MONGOLAB_URI, {});
    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/performances.json`, 'utf8', (readFileErr, data) => __awaiter(this, void 0, void 0, function* () {
        if (readFileErr instanceof Error) {
            throw readFileErr;
        }
        const performances = JSON.parse(data);
        const screens = yield chevre_domain_1.Models.Screen.find({}, 'name theater').populate('theater', 'name').exec();
        // あれば更新、なければ追加
        const promises = performances.map((performance) => __awaiter(this, void 0, void 0, function* () {
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
            yield chevre_domain_1.Models.Performance.create(performance);
            debug('performance created');
        }));
        yield Promise.all(promises);
        debug('promised.');
        mongoose.disconnect();
        process.exit(0);
    }));
}
exports.createFromJson = createFromJson;
/**
 * 空席ステータスを更新する
 *
 * @memberOf PerformanceController
 */
function updateStatuses() {
    return __awaiter(this, void 0, void 0, function* () {
        mongoose.connect(process.env.MONGOLAB_URI, {});
        debug('finding performances...');
        const performances = yield chevre_domain_1.Models.Performance.find({}, 'day start_time screen')
            .populate('screen', 'seats_number')
            .exec();
        debug('performances found.');
        const performanceStatusesModel = chevre_domain_1.PerformanceStatusesModel.create();
        debug('aggregating...');
        const results = yield chevre_domain_1.Models.Reservation.aggregate([
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
        yield chevre_domain_1.PerformanceStatusesModel.store(performanceStatusesModel);
        debug('performanceStatusesModel saved.');
        mongoose.disconnect();
        process.exit(0);
    });
}
exports.updateStatuses = updateStatuses;
/**
 * ID指定でパフォーマンスを公開する
 *
 * @memberOf PerformanceController
 */
function release(performanceId) {
    mongoose.connect(process.env.MONGOLAB_URI, {});
    debug('updating performance..._id:', performanceId);
    chevre_domain_1.Models.Performance.findOneAndUpdate({
        _id: performanceId
    }, {
        canceled: false
    }, {
        new: true
    }, (err, performance) => {
        debug('performance updated', err, performance);
        mongoose.disconnect();
        process.exit(0);
    });
}
exports.release = release;
