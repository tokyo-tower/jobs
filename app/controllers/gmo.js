"use strict";
/**
 * GMOタスクコントローラー
 *
 * @namespace controller/gmo
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
const conf = require("config");
const createDebug = require("debug");
const moment = require("moment");
const numeral = require("numeral");
const debug = createDebug('ttts-jobs:controller:gmo');
const DEFAULT_RADIX = 10;
// 返金キャンセル料(0円)
const CANCEL_CHARGE_REFUND = 0;
/**
 * GMO結果通知を処理する
 *
 * @memberOf controller/gmo
 */
// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
function processOne() {
    return __awaiter(this, void 0, void 0, function* () {
        // 最終的に通知にセットする処理ステータス
        let notificationProcessStatus = ttts.GMONotificationUtil.PROCESS_STATUS_UNPROCESSED;
        debug('finding notification...');
        const notification = yield ttts.Models.GMONotification.findOneAndUpdate({ process_status: ttts.GMONotificationUtil.PROCESS_STATUS_UNPROCESSED }, { process_status: ttts.GMONotificationUtil.PROCESS_STATUS_PROCESSING }, { new: true }).exec();
        debug('notification found.', notification);
        if (notification !== null) {
            try {
                // 内容の整合性チェック
                debug('finding reservations...payment_no:', notification.get('order_id'));
                const parsedOrderId = ttts.ReservationUtil.parseGMOOrderId(notification.get('order_id'));
                const reservations = yield ttts.Models.Reservation.find({
                    performance_day: parsedOrderId.performanceDay,
                    payment_no: parsedOrderId.paymentNo
                }).exec();
                debug('reservations found.', reservations.length);
                if (reservations.length > 0) {
                    // チェック文字列
                    // todo
                    // const shopPassString = GMOUtil.createShopPassString({
                    //     shopId: notification.get('shop_id'),
                    //     shopPass: process.env.GMO_SHOP_PASS,
                    //     orderId: notification.get('order_id'),
                    //     amount: notification.get('amount'),
                    //     dateTime: moment(reservations[0].get('purchased_at')).format('YYYYMMDDHHmmss')
                    // });
                    // debug('shopPassString must be ', reservations[0].get('gmo_shop_pass_string'));
                    // if (shopPassString !== reservations[0].get('gmo_shop_pass_string')) {
                    //     // 不正な結果通知なので、処理済みにする
                    //     await next(null, notification);
                    //     return;
                    // }
                    // クレジットカード決済の場合
                    let rawUpdateReservation;
                    if (notification.get('pay_type') === ttts.GMO.utils.util.PayType.Credit) {
                        switch (notification.get('status')) {
                            case ttts.GMO.utils.util.Status.Unprocessed:
                            case ttts.GMO.utils.util.Status.Capture:
                            case ttts.GMO.utils.util.Status.Authenticated:
                            case ttts.GMO.utils.util.Status.Check:
                            case ttts.GMO.utils.util.Status.Auth:
                            case ttts.GMO.utils.util.Status.Sales:
                            case ttts.GMO.utils.util.Status.Return:
                            case ttts.GMO.utils.util.Status.Returnx:
                            case ttts.GMO.utils.util.Status.Sauth:
                                // 何もしない
                                break;
                            case ttts.GMO.utils.util.Status.Void:// 取消し
                                // 空席に戻さない(つくったけれども、連動しない方向で仕様決定)
                                break;
                            default:
                                // 何もしない
                                break;
                        }
                    }
                    else if (notification.get('pay_type') === ttts.GMO.utils.util.PayType.Cvs) {
                        switch (notification.get('status')) {
                            case ttts.GMO.utils.util.Status.Paysuccess:
                                // 予約完了ステータスへ変更
                                debug('updating reservations by paymentNo...', notification.get('order_id'));
                                yield ttts.Models.Reservation.update({ gmo_order_id: notification.get('order_id') }, {
                                    status: ttts.ReservationUtil.STATUS_RESERVED,
                                    updated_user: 'system'
                                }, { multi: true }).exec();
                                debug('reservations updated');
                                // 完了メールキュー追加(あれば更新日時を更新するだけ)
                                // todo 新メールキュー方式に変更
                                debug('creating reservationEmailCue...');
                                // await Models.ReservationEmailCue.findOneAndUpdate(
                                //     {
                                //         payment_no: notification.get('order_id'),
                                //         template: ReservationEmailCueUtil.TEMPLATE_COMPLETE
                                //     },
                                //     {
                                //         $set: { updated_at: Date.now() },
                                //         $setOnInsert: { status: ReservationEmailCueUtil.STATUS_UNSENT }
                                //     },
                                //     {
                                //         upsert: true,
                                //         new: true
                                //     }
                                // ).exec();
                                debug('reservationEmailCue created.');
                                // あったにせよなかったにせよ処理済に
                                break;
                            case ttts.GMO.utils.util.Status.Reqsuccess:
                                // GMOパラメータを予約に追加
                                debug('updating reservations by paymentNo...', notification.get('order_id'));
                                rawUpdateReservation = yield ttts.Models.Reservation.update({ payment_no: notification.get('order_id') }, {
                                    gmo_shop_id: notification.get('shop_id'),
                                    gmo_amount: notification.get('amount'),
                                    gmo_tax: notification.get('tax'),
                                    gmo_cvs_code: notification.get('cvs_code'),
                                    gmo_cvs_conf_no: notification.get('cvs_conf_no'),
                                    gmo_cvs_receipt_no: notification.get('cvs_receipt_no'),
                                    gmo_payment_term: notification.get('payment_term'),
                                    updated_user: 'system'
                                }, { multi: true }).exec();
                                debug('reservations updated.', rawUpdateReservation);
                                // 仮予約完了メールキュー追加(あれば更新日時を更新するだけ)
                                // todo 新メールキュー方式に変更
                                // debug('creating reservationEmailCue...');
                                // await Models.ReservationEmailCue.findOneAndUpdate(
                                //     {
                                //         payment_no: notification.get('order_id'),
                                //         template: ReservationEmailCueUtil.TEMPLATE_TEMPORARY
                                //     },
                                //     {
                                //         $set: { updated_at: Date.now() },
                                //         $setOnInsert: { status: ReservationEmailCueUtil.STATUS_UNSENT }
                                //     },
                                //     {
                                //         upsert: true,
                                //         new: true
                                //     }
                                // ).exec();
                                // debug('reservationEmailCue created.');
                                // あったにせよなかったにせよ処理済に
                                break;
                            case ttts.GMO.utils.util.Status.Unprocessed:
                                // 何もしない
                                break;
                            case ttts.GMO.utils.util.Status.Payfail: // 決済失敗
                            case ttts.GMO.utils.util.Status.Cancel:// 支払い停止
                                // 空席に戻す
                                debug('removing reservations...gmo_order_id:', notification.get('order_id'));
                                yield Promise.all(reservations.map((reservation) => __awaiter(this, void 0, void 0, function* () {
                                    debug('removing reservation...', reservation.get('_id'));
                                    yield reservation.remove();
                                    debug('reservation removed.', reservation.get('_id'));
                                })));
                                break;
                            case ttts.GMO.utils.util.Status.Expired:// 期限切れ
                                // 空席に戻す
                                debug('removing reservations...payment_no:', notification.get('order_id'));
                                const promises = reservations.map((reservation) => __awaiter(this, void 0, void 0, function* () {
                                    debug('removing reservation...', reservation.get('_id'));
                                    yield reservation.remove();
                                    debug('reservation removed.', reservation.get('_id'));
                                }));
                                yield Promise.all(promises);
                                break;
                            default:
                                break;
                        }
                    }
                    else {
                        // 他の決済は本案件では非対応なので何もしない
                    }
                }
                // 処理済みに
                notificationProcessStatus = ttts.GMONotificationUtil.PROCESS_STATUS_PROCESSED;
            }
            catch (error) {
                console.error(error);
            }
            // 処理ステータス変更
            yield ttts.Models.GMONotification.findByIdAndUpdate(notification.get('_id'), { process_status: notificationProcessStatus }).exec();
        }
    });
}
exports.processOne = processOne;
/**
 * GMO実売上
 */
// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
function settleGMOAuth() {
    return __awaiter(this, void 0, void 0, function* () {
        const reservation = yield ttts.Models.Reservation.findOneAndUpdate({
            status: ttts.ReservationUtil.STATUS_RESERVED,
            gmo_status: ttts.GMO.utils.util.Status.Auth,
            payment_method: ttts.GMO.utils.util.PayType.Credit,
            payment_seat_index: 0
        }, 
        // tslint:disable-next-line:align
        { gmo_status: ttts.GMONotificationUtil.PROCESS_STATUS_PROCESSING }).exec();
        if (reservation !== null) {
            const searchArgin = {
                shopId: process.env.GMO_SHOP_ID,
                shopPass: process.env.GMO_SHOP_PASS,
                orderId: reservation.get('gmo_order_id')
            };
            // 取引状態参照
            const searchTradeResult = yield ttts.GMO.services.credit.searchTrade(searchArgin);
            if (searchTradeResult.jobCd === ttts.GMO.utils.util.JobCd.Sales) {
                // すでに実売上済み
                return;
            }
            // チェック文字列
            const shopPassString = ttts.GMO.utils.util.createShopPassString({
                shopId: process.env.GMO_SHOP_ID,
                orderId: reservation.get('gmo_order_id'),
                amount: +searchTradeResult.amount,
                shopPass: process.env.GMO_SHOP_PASS,
                dateTime: moment(reservation.get('purchased_at')).format('YYYYMMDDHHmmss')
            });
            if (shopPassString !== reservation.get('gmo_shop_pass_string')) {
                // tslint:disable-next-line:no-suspicious-comment
                // TODO
                return;
            }
            try {
                yield ttts.GMO.services.credit.alterTran({
                    shopId: process.env.GMO_SHOP_ID,
                    shopPass: process.env.GMO_SHOP_PASS,
                    accessId: searchTradeResult.accessId,
                    accessPass: searchTradeResult.accessPass,
                    jobCd: ttts.GMO.utils.util.JobCd.Sales,
                    amount: parseInt(searchTradeResult.amount, DEFAULT_RADIX)
                });
            }
            catch (error) {
                // tslint:disable-next-line:no-console
                console.log(error);
                return;
            }
            yield ttts.Models.Reservation.findOneAndUpdate({ _id: reservation._id }, {
                $set: {
                    gmo_status: ttts.GMO.utils.util.Status.Sales,
                    gmo_tran_date: moment().format('YYYYMMDD')
                }
            }).exec();
        }
    });
}
exports.settleGMOAuth = settleGMOAuth;
/**
 * GMO返金(エレベータ運用停止の対応)
 */
function refundForSuspend() {
    return __awaiter(this, void 0, void 0, function* () {
        // 対象パフォーマンス取得
        // targrtInfoByPayment: {'20171201_12345': [r1,r2,,,rn]}
        const info = yield getRefundReservations();
        const reservationInfo = info.targrtInfoByPayment;
        const now = moment().format('YYYY/MM/DD HH:mm:ss');
        const performanceInfo = {};
        // GMO返金処理(購入単位)
        for (const key of Object.keys(reservationInfo)) {
            const reservation = reservationInfo[key][0];
            // 取引状態参照
            const searchResult = yield ttts.GMO.services.credit.searchTrade({
                shopId: process.env.GMO_SHOP_ID,
                shopPass: process.env.GMO_SHOP_PASS,
                orderId: reservation.gmo_order_id
            });
            // 返金済ではない時(リトライ時エラーにならないためのIf分)
            if (searchResult.status !== ttts.GMO.utils.util.JobCd.Return) {
                // 決済取り消し(返品)処理
                yield ttts.GMO.services.credit.alterTran({
                    shopId: process.env.GMO_SHOP_ID,
                    shopPass: process.env.GMO_SHOP_PASS,
                    accessId: reservation.gmo_access_id,
                    accessPass: reservation.gmo_access_pass,
                    jobCd: ttts.GMO.utils.util.JobCd.Return
                });
                // パフォーマンス単位の返金数セット
                if (performanceInfo.hasOwnProperty(reservation.performance) === false) {
                    // ※リトライ前提なら初期値は0ではなく、パフォーマンスから現在の返金済数を取得する必要あり
                    performanceInfo[reservation.performance] = yield getPerformanceRefundCount(reservation.performance);
                }
                // +1は購入数、lengthはレコード数
                //performanceInfo[reservation.performance] += 1;
                performanceInfo[reservation.performance] += getRefundCount(reservationInfo[key]);
                // 返金メール作成
                yield createEmail(reservationInfo[key]);
            }
            // キャンセルリクエスト保管(返金情報は'3'(返金完了)に更新)
            const reservationNew = reservationInfo[key][0];
            reservationNew.performance_ttts_extension.refund_status = ttts.PerformanceUtil.REFUND_STATUS.COMPLETE;
            reservationNew.performance_ttts_extension.refund_update_at = now;
            yield createCustomerCancelRequest(reservationNew, reservationInfo[key]);
            // 予約データクリア
            yield clearReservation(reservationInfo[key]);
        }
        // パフォーマンスに返金状態、返金済み数を更新
        for (const performanceId of Object.keys(performanceInfo)) {
            const paymentCount = performanceInfo[performanceId];
            // パフォーマンス更新
            yield ttts.Models.Performance.findOneAndUpdate({
                _id: performanceId
            }, {
                $set: {
                    'ttts_extension.refunded_count': paymentCount,
                    'ttts_extension.refund_status': ttts.PerformanceUtil.REFUND_STATUS.COMPLETE,
                    'ttts_extension.refund_update_at': now
                }
            }).exec();
        }
    });
}
exports.refundForSuspend = refundForSuspend;
/**
 * 返金対象予約情報取得
 *
 *  info: {
 *     targrtInfoByPayment: {'20171201_12345': [r1,r2,,,rn]}
 * }
 *
 * @return {any}
 */
function getRefundReservations() {
    return __awaiter(this, void 0, void 0, function* () {
        let info = null;
        // 返金対象予約取得(一般予約かつ返金ステータスが指示済)
        const reservations = yield ttts.Models.Reservation.find({
            purchaser_group: ttts.ReservationUtil.PURCHASER_GROUP_CUSTOMER,
            'performance_ttts_extension.refund_status': ttts.PerformanceUtil.REFUND_STATUS.INSTRUCTED
        }).exec();
        // 入塔済の予約情報セット
        const arrivedInfos = [];
        reservations.map((reservation) => {
            // 入塔済情報 [{performance_day:'20171201', payment_no:'12345'}]
            if (reservation.checkins.length > 0) {
                arrivedInfos.push({
                    performance_day: reservation.performance_day,
                    payment_no: reservation.payment_no
                });
            }
        });
        // 入塔済判定
        const isArrived = (reservation) => {
            for (const arrivedInfo of arrivedInfos) {
                if (arrivedInfo.performance_day === reservation.performance_day &&
                    arrivedInfo.payment_no === reservation.payment_no) {
                    return true;
                }
            }
            return false;
        };
        // 更新対象の予約IDセット
        const targrtInfoByPayment = {};
        //const targrtInfoByPerformance: any[] = [];
        reservations.map((reservation) => {
            // 入塔記録がない時
            if (isArrived(reservation) === false) {
                // 返金対象(購入単位) [{'20171201_12345': [r1,r2,,,rn]}]
                const key = `${reservation.performance_day}_${reservation.payment_no}`;
                if (targrtInfoByPayment.hasOwnProperty(key) === false) {
                    targrtInfoByPayment[key] = [];
                }
                targrtInfoByPayment[key].push(reservation);
            }
        });
        // 戻り値セット
        info = {};
        info.targrtInfoByPayment = targrtInfoByPayment;
        return info;
    });
}
/**
 * 現在のパフォーマンスにセットされている返金数取得
 *
 * @return {number}
 */
function getPerformanceRefundCount(performanceId) {
    return __awaiter(this, void 0, void 0, function* () {
        // パフォーマンス更新
        const performance = yield ttts.Models.Performance.findById({
            _id: performanceId
        }).exec();
        return performance !== null ? performance.ttts_extension.refunded_count : 0;
    });
}
/**
 * 返金予約数取得
 *   (車椅子チケットは4レコードで1予約)
 *
 * @return {number}
 */
function getRefundCount(reservations) {
    let count = 0;
    for (const reservation of reservations) {
        if (reservation.status === ttts.ReservationUtil.STATUS_RESERVED) {
            count += 1;
        }
    }
    return count;
}
/**
 * 返金メール作成(1通)
 *
 * @param {Response} res
 * @param {any} reservation
 * @param {any} notice
 * @return {Promise<void>}
 */
function createEmail(reservations) {
    return __awaiter(this, void 0, void 0, function* () {
        if (reservations === null) {
            return;
        }
        const reservation = reservations[0];
        // 本文編集(日本語)
        const infoJa = getEmailMessages(reservation, 'ja');
        const contentJa = `${infoJa.titleEmail}\n\n${infoJa.purchaserName}\n\n${infoJa.messageInfos.join('\n')}`;
        // 本文編集(英語)
        const infoEn = getEmailMessages(reservation, 'en');
        const contentEn = `${infoEn.titleEmail}\n\n${infoEn.purchaserName}\n\n${infoEn.messageInfos.join('\n')}`;
        const line = '--------------------------------------------------';
        // メール編集
        const emailQueue = {
            from: {
                address: conf.get('email.from'),
                name: conf.get('email.fromname')
            },
            to: {
                address: reservation.purchaser_email
            },
            subject: `${infoJa.title} ${infoJa.titleEmail} (${infoEn.title} ${infoEn.titleEmail})`,
            content: {
                mimetype: 'text/plain',
                text: `${contentJa}\n\n${line}\n${contentEn}`
            },
            status: ttts.EmailQueueUtil.STATUS_UNSENT
        };
        // メール作成
        yield ttts.Models.EmailQueue.create(emailQueue);
    });
}
/**
 * メールメッセージ取得
 *
 * @param {any} reservation
 * @param {any} locale
 * @return {any}
 */
function getEmailMessages(reservation, locale) {
    // 購入者氏名
    const purchaserName = reservation.purchaser_name[locale];
    // 入塔日
    const day = moment(reservation.performance_day, 'YYYYMMDD').format('YYYY/MM/DD');
    // tslint:disable-next-line:no-magic-numbers
    const time = `${reservation.performance_start_time.substr(0, 2)}:${reservation.performance_start_time.substr(2, 2)}`;
    // 返金額
    const amount = numeral(reservation.gmo_amount).format('0,0');
    // 返金メールメッセージ
    const messages = conf.get(`emailRefund.${locale}.messages`);
    // 購入チケット情報
    const messageInfos = [];
    for (const message of messages) {
        let editMessage = message;
        // 購入番号 : 850000001
        editMessage = editMessage.replace('$payment_no$', reservation.payment_no);
        // ご来塔日時 : 2017/12/10 09:15
        editMessage = editMessage.replace('$day$', day);
        editMessage = editMessage.replace('$start_time$', time);
        // 返金金額 : \8,400
        editMessage = editMessage.replace('$amount$', amount);
        messageInfos.push(editMessage);
    }
    return {
        // 東京タワー TOP DECK Ticket
        title: conf.get(`emailRefund.${locale}.title`),
        // 返金のお知らせ
        titleEmail: conf.get(`emailRefund.${locale}.titleEmail`),
        //トウキョウ タロウ 様
        purchaserName: conf.get(`emailRefund.${locale}.destinationName`).replace('$purchaser_name$', purchaserName),
        // 返金メールメッセージ
        messageInfos: messageInfos
    };
}
/**
 * 予約情報クリア
 *
 * @param {any} reservations
 * @return {Promise<void>}
 */
function clearReservation(reservations) {
    return __awaiter(this, void 0, void 0, function* () {
        const promises = (reservations.map((reservation) => __awaiter(this, void 0, void 0, function* () {
            // 本体チケットかつ特殊チケットの時、時間ごとの予約データ解放(AVAILABLEに変更)
            if (reservation.ticket_ttts_extension.category !== ttts.TicketTypeGroupUtil.TICKET_TYPE_CATEGORY_NORMAL &&
                reservation.seat_code === reservation.reservation_ttts_extension.seat_code_base) {
                yield ttts.Models.ReservationPerHour.findOneAndUpdate({ reservation_id: reservation._id.toString() }, {
                    $set: { status: ttts.ReservationUtil.STATUS_AVAILABLE },
                    $unset: { expired_at: 1, reservation_id: 1 }
                }, { new: true }).exec();
                //logger.info('ReservationPerHour clear reservation_id=', reservation._id.toString());
            }
            // 予約データ解放(AVAILABLEに変更)
            yield ttts.Models.Reservation.findByIdAndUpdate(reservation._id, {
                $set: { status: ttts.ReservationUtil.STATUS_AVAILABLE },
                $unset: getUnsetFields(reservation._doc)
            }).exec();
        })));
        yield Promise.all(promises);
    });
}
/**
 * 更新時削除フィールド取得
 *
 * @param {any} reservation
 * @return {any} unset
 */
function getUnsetFields(reservation) {
    const setFields = [
        '_id',
        'performance',
        'seat_code',
        'updated_at',
        'checkins',
        'performance_canceled',
        'status',
        '__v',
        'created_at'
    ];
    const unset = {};
    // セットフィールド以外は削除フィールドにセット
    Object.getOwnPropertyNames(reservation).forEach((propertyName) => {
        if (setFields.indexOf(propertyName) < 0) {
            unset[propertyName] = 1;
        }
    });
    return unset;
}
/**
 * キャンセルリクエスト保管
 *
 * @param {any} reservationNew
 * @param {any} reservations
 * @return {Promise<void>}
 */
function createCustomerCancelRequest(reservationNew, reservations) {
    return __awaiter(this, void 0, void 0, function* () {
        yield ttts.Models.CustomerCancelRequest.create({
            reservation: reservationNew,
            tickets: ttts.Models.CustomerCancelRequest.getTickets(reservations),
            cancel_name: `${reservationNew.purchaser_last_name} ${reservationNew.purchaser_first_name}`,
            cancellation_fee: CANCEL_CHARGE_REFUND
        });
    });
}
