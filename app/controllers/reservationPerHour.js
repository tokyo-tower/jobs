"use strict";
/**
 * パフォーマンスタスクコントローラー
 * @namespace controller/reservationPerHour
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
const moment = require("moment");
const debug = createDebug('ttts-jobs:controller:performance');
/**
 *
 *
 * @memberof controller/reservationPerHour
 */
function createFromSetting() {
    return __awaiter(this, void 0, void 0, function* () {
        // 引数情報取得
        const targetInfo = getTargetInfoForCreateFromSetting();
        const hours = targetInfo.hours;
        const days = targetInfo.days;
        const reservationPerHour = {
            ticket_category: ttts.TicketTypeGroupUtil.TICKET_TYPE_CATEGORY_WHEELCHAIR,
            status: ttts.factory.itemAvailability.InStock
        };
        // 日数分Loop
        const promisesDay = (days.map((day) => __awaiter(this, void 0, void 0, function* () {
            reservationPerHour.performance_day = day;
            // 時間分Loop
            const promisesHour = (hours.map((hour) => __awaiter(this, void 0, void 0, function* () {
                // 時間帯セット
                reservationPerHour.performance_hour = hour;
                // 時間ごとの予約情報登録
                debug('creating reservationPerHour...');
                //スクリーン、作品、上映日、開始時間
                const result = yield ttts.Models.ReservationPerHour.findOneAndUpdate({
                    performance_day: reservationPerHour.performance_day,
                    performance_hour: reservationPerHour.performance_hour
                }, {
                    //$set: reservationPerHour
                    $setOnInsert: reservationPerHour
                }, {
                    upsert: true,
                    new: true
                }).exec();
                if (result !== null) {
                    // tslint:disable-next-line:no-console
                    console.log(result);
                }
                debug('reservationPerHour created');
            })));
            yield Promise.all(promisesHour);
        })));
        yield Promise.all(promisesDay);
    });
}
exports.createFromSetting = createFromSetting;
/**
 * 時間ごとの予約情報作成・作成対象情報取得
 *
 * @memberof controller/reservationPerHour
 */
function getTargetInfoForCreateFromSetting() {
    const info = {};
    info.days = [];
    info.hours = [];
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
    const hourLength = 2;
    hours.forEach((hour) => {
        // 2桁でない時は'0'詰め
        hour = (hour.length < hourLength) ? `0${hour}` : hour;
        info.hours.push(hour);
    });
    return info;
}
/**
 * 仮予約ステータスで、一定時間過ぎた予約を空席にする
 * (statusを"AVAILABLE"戻す)
 *
 * @memberof reservationPerHour
 */
function resetTmps() {
    return __awaiter(this, void 0, void 0, function* () {
        const BUFFER_PERIOD_SECONDS = -60;
        debug('resetting temporary reservationPerHour...');
        yield ttts.Models.ReservationPerHour.update({
            status: ttts.factory.itemAvailability.SoldOut,
            expired_at: {
                // 念のため、仮予約有効期間より1分長めにしておく
                $lt: moment().add(BUFFER_PERIOD_SECONDS, 'seconds').toISOString()
            }
        }, {
            $set: {
                status: ttts.factory.itemAvailability.InStock
            },
            $unset: {
                expired_at: 1,
                reservation_id: 1
            }
        }, {
            multi: true
        }).exec();
        debug('temporary reservationPerHour reset.');
        // 失敗しても、次のタスクにまかせる(気にしない)
    });
}
exports.resetTmps = resetTmps;
