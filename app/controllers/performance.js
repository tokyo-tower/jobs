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
const fs = require("fs-extra");
const log4js = require("log4js");
const mongoose = require("mongoose");
const MONGOLAB_URI = process.env.MONGOLAB_URI;
const DEFAULT_RADIX = 10;
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
 * @memberOf PerformanceController
 */
function createFromJson() {
    mongoose.connect(MONGOLAB_URI, {});
    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/performances.json`, 'utf8', (readFileErr, data) => __awaiter(this, void 0, void 0, function* () {
        if (readFileErr instanceof Error)
            throw readFileErr;
        const performances = JSON.parse(data);
        const screens = yield chevre_domain_1.Models.Screen.find({}, 'name theater').populate('theater', 'name').exec();
        // あれば更新、なければ追加
        const promises = performances.map((performance) => __awaiter(this, void 0, void 0, function* () {
            // 劇場とスクリーン名称を追加
            const screenOfPerformance = screens.find((screen) => {
                return (screen.get('_id').toString() === performance.screen);
            });
            if (screenOfPerformance === undefined)
                throw new Error('screen not found.');
            performance.screen_name = screenOfPerformance.get('name');
            performance.theater_name = screenOfPerformance.get('theater').get('name');
            logger.debug('updating performance...');
            yield chevre_domain_1.Models.Performance.findOneAndUpdate({ _id: performance._id }, performance, {
                new: true,
                upsert: true
            }).exec();
            logger.debug('performance updated');
        }));
        yield Promise.all(promises);
        logger.info('promised.');
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
        mongoose.connect(MONGOLAB_URI, {});
        logger.info('finding performances...');
        const performances = yield chevre_domain_1.Models.Performance.find({}, 'day start_time screen')
            .populate('screen', 'seats_number')
            .exec();
        logger.info('performances found.');
        const performanceStatusesModel = chevre_domain_1.PerformanceStatusesModel.create();
        logger.info('aggregating...');
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
        logger.info('saving performanceStatusesModel...', performanceStatusesModel);
        chevre_domain_1.PerformanceStatusesModel.store(performanceStatusesModel, (storeErr) => {
            logger.info('performanceStatusesModel saved.', storeErr);
            mongoose.disconnect();
            process.exit(0);
        });
    });
}
exports.updateStatuses = updateStatuses;
/**
 * ID指定でパフォーマンスを公開する
 *
 * @memberOf PerformanceController
 */
function release(performanceId) {
    mongoose.connect(MONGOLAB_URI, {});
    logger.info('updating performance..._id:', performanceId);
    chevre_domain_1.Models.Performance.findOneAndUpdate({
        _id: performanceId
    }, {
        canceled: false
    }, {
        new: true
    }, (err, performance) => {
        logger.info('performance updated', err, performance);
        mongoose.disconnect();
        process.exit(0);
    });
}
exports.release = release;
