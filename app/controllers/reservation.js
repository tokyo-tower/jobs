"use strict";
/**
 * 座席予約タスクコントローラー
 *
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
const gmo_service_1 = require("@motionpicture/gmo-service");
const ttts_domain_1 = require("@motionpicture/ttts-domain");
const conf = require("config");
const createDebug = require("debug");
const fs = require("fs-extra");
const moment = require("moment");
const querystring = require("querystring");
const request = require("request");
const debug = createDebug('ttts-jobs:controller:reservation');
const STATUS_AVAILABLE = 'AVAILABLE';
/**
 *
 *
 * @memberOf controller/reservation
 */
function createFromSetting() {
    return __awaiter(this, void 0, void 0, function* () {
        // 引数情報取得
        const targetInfo = getTargetInfoForCreateFromSetting();
        const times = targetInfo.startTimes;
        const days = targetInfo.days;
        // 作成情報取得(作品、スクリーン、作成日(引数の日数より)、開始時刻(引数の時刻より))
        const setting = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/setting.json`);
        const performances = yield ttts_domain_1.Models.Performance.find({
            film: setting.film,
            screen: setting.screen,
            day: { $in: days },
            start_time: { $in: times }
        }, '_id').exec();
        // 劇場とスクリーン情報取得
        const screenOfPerformance = yield ttts_domain_1.Models.Screen.findById(setting.screen, 'name theater sections')
            .populate('theater', 'name address')
            .exec();
        if (screenOfPerformance === undefined) {
            throw new Error('screen not found.');
        }
        // 予約登録・パフォーマンス分Loop
        const promisesR = (performances.map((performance) => __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-console
            console.info(performance._id);
            // 座席分Loop
            const promisesS = (screenOfPerformance.get('sections')[0].seats.map((seat) => __awaiter(this, void 0, void 0, function* () {
                const reservation = {};
                reservation.performance = performance._id;
                reservation.seat_code = seat.code;
                reservation.status = STATUS_AVAILABLE;
                reservation.performance_canceled = false;
                reservation.checkins = [];
                const result = yield ttts_domain_1.Models.Reservation.findOneAndUpdate({
                    performance: reservation.performance,
                    seat_code: reservation.seat_code
                }, {
                    //なければ作成あれば更新：値は先勝ちで作成
                    //間違って同じ日の予約を流した時、すでに予約に進んでいるデータを壊さないため。
                    //$set: reservation
                    // 新規作成時のみセットしたいカラムは$setOnInsertに設定
                    // 項目が重なっているとエラーになる↓
                    // MongoError: Cannot update 'film' and 'film' at the same time
                    $setOnInsert: reservation
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
            yield Promise.all(promisesS);
        })));
        yield Promise.all(promisesR);
    });
}
exports.createFromSetting = createFromSetting;
/**
 * パフォーマンス作成・作成対象情報取得
 *
 * @memberOf controller/performance
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
/**
 * 仮予約ステータスで、一定時間過ぎた予約を空席にする
 *
 * @memberOf ReservationController
 */
function removeTmps() {
    return __awaiter(this, void 0, void 0, function* () {
        const BUFFER_PERIOD_SECONDS = -60;
        debug('removing temporary reservations...');
        yield ttts_domain_1.Models.Reservation.remove({
            status: ttts_domain_1.ReservationUtil.STATUS_TEMPORARY,
            expired_at: {
                // 念のため、仮予約有効期間より1分長めにしておく
                $lt: moment().add(BUFFER_PERIOD_SECONDS, 'seconds').toISOString()
            }
        }).exec();
        debug('temporary reservations removed.');
        // 失敗しても、次のタスクにまかせる(気にしない)
    });
}
exports.removeTmps = removeTmps;
/**
 * 仮予約ステータスで、一定時間過ぎた予約を空席にする
 * (2017/05/23 削除→statusを"AVAILABLE"戻す、に変更)
 * removeTmpsは未使用になります。
 *
 * @memberOf ReservationController
 */
function resetTmps() {
    return __awaiter(this, void 0, void 0, function* () {
        const BUFFER_PERIOD_SECONDS = -60;
        debug('resetting temporary reservations...');
        yield ttts_domain_1.Models.Reservation.findOneAndUpdate({
            status: ttts_domain_1.ReservationUtil.STATUS_TEMPORARY,
            expired_at: {
                // 念のため、仮予約有効期間より1分長めにしておく
                $lt: moment().add(BUFFER_PERIOD_SECONDS, 'seconds').toISOString()
            }
        }, {
            status: STATUS_AVAILABLE,
            payment_no: null,
            ticket_type: null,
            expired_at: null
        }).exec();
        debug('temporary reservations reset.');
        // 失敗しても、次のタスクにまかせる(気にしない)
    });
}
exports.resetTmps = resetTmps;
/**
 * TTTS確保上の仮予約をTTTS確保へ戻す
 *
 * @memberOf ReservationController
 */
function tmp2ttts() {
    return __awaiter(this, void 0, void 0, function* () {
        const BUFFER_PERIOD_SECONDS = -60;
        const ids = yield ttts_domain_1.Models.Reservation.distinct('_id', {
            status: ttts_domain_1.ReservationUtil.STATUS_TEMPORARY_ON_KEPT_BY_TTTS,
            expired_at: {
                // 念のため、仮予約有効期間より1分長めにしておく
                $lt: moment().add(BUFFER_PERIOD_SECONDS, 'seconds').toISOString()
            }
        }).exec();
        yield Promise.all(ids.map((id) => __awaiter(this, void 0, void 0, function* () {
            yield ttts_domain_1.Models.Reservation.findByIdAndUpdate(id, { status: ttts_domain_1.ReservationUtil.STATUS_KEPT_BY_TTTS }).exec();
        })));
    });
}
exports.tmp2ttts = tmp2ttts;
/**
 * 固定日時を経過したら、空席ステータスにするバッチ
 *
 * @memberOf ReservationController
 */
function releaseSeatsKeptByMembers() {
    return __awaiter(this, void 0, void 0, function* () {
        if (moment(conf.get('datetimes.reservation_end_members')) < moment()) {
            // 空席にする場合はこちら
            debug('releasing reservations kept by members...');
            yield ttts_domain_1.Models.Reservation.remove({
                status: ttts_domain_1.ReservationUtil.STATUS_KEPT_BY_MEMBER
            }).exec();
            // 失敗しても、次のタスクにまかせる(気にしない)
        }
    });
}
exports.releaseSeatsKeptByMembers = releaseSeatsKeptByMembers;
/**
 * GMO離脱データを解放する(内部確保)
 * todo 空席に変更する仕様に変更
 *
 * @memberOf ReservationController
 */
function releaseGarbages() {
    return __awaiter(this, void 0, void 0, function* () {
        // 一定期間WAITING_SETTLEMENTの予約を抽出
        const WAITING_PERIOD_HOURS = -2;
        const reservations = yield ttts_domain_1.Models.Reservation.find({
            status: ttts_domain_1.ReservationUtil.STATUS_WAITING_SETTLEMENT,
            updated_at: { $lt: moment().add(WAITING_PERIOD_HOURS, 'hours').toISOString() }
        }).exec();
        const paymentNos4release = [];
        const gmoUrl = (process.env.NODE_ENV === 'production') ?
            'https://p01.mul-pay.jp/payment/SearchTradeMulti.idPass' :
            'https://pt01.mul-pay.jp/payment/SearchTradeMulti.idPass';
        const promises = reservations.map((reservation) => __awaiter(this, void 0, void 0, function* () {
            // GMO取引状態参照
            debug('requesting... ');
            request.post({
                url: gmoUrl,
                form: {
                    ShopID: process.env.GMO_SHOP_ID,
                    ShopPass: process.env.GMO_SHOP_PASS,
                    OrderID: reservation.get('gmo_order_id'),
                    PayType: reservation.get('payment_method')
                }
            }, (error, response, body) => {
                const STATUS_CODE_OK = 200;
                debug('request processed.', error);
                if (error instanceof Error) {
                    throw error;
                }
                if (response.statusCode !== STATUS_CODE_OK) {
                    throw new Error(`statusCode is ${response.statusCode}`);
                }
                const searchTradeResult = querystring.parse(body);
                // GMOにない、あるいは、UNPROCESSEDであれば離脱データ
                if (searchTradeResult.ErrCode !== undefined) {
                    // M01-M01004002
                    // 指定されたオーダーIDの取引は登録されていません。
                    if (searchTradeResult.ErrCode === 'M01' && searchTradeResult.ErrInfo === 'M01004002') {
                        paymentNos4release.push(reservation.get('payment_no'));
                    }
                }
                else {
                    if (searchTradeResult.Status === gmo_service_1.Util.STATUS_CVS_UNPROCESSED ||
                        searchTradeResult.Status === gmo_service_1.Util.STATUS_CREDIT_UNPROCESSED) {
                        paymentNos4release.push(reservation.get('payment_no'));
                    }
                }
            });
        }));
        yield Promise.all(promises);
        debug('promised.');
        if (paymentNos4release.length === 0) {
            return;
        }
        // 予約削除
        debug('updating reservations...');
        yield ttts_domain_1.Models.Reservation.remove({
            payment_no: { $in: paymentNos4release }
        }).exec();
    });
}
exports.releaseGarbages = releaseGarbages;
