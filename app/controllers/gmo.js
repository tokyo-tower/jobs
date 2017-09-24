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
const gmo_service_1 = require("@motionpicture/gmo-service");
const GMO = require("@motionpicture/gmo-service");
const TTTS = require("@motionpicture/ttts-domain");
const createDebug = require("debug");
const moment = require("moment");
const debug = createDebug('ttts-jobs:controller:gmo');
/**
 * GMO結果通知を処理する
 *
 * @memberOf controller/gmo
 */
// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
function processOne() {
    return __awaiter(this, void 0, void 0, function* () {
        // 最終的に通知にセットする処理ステータス
        let notificationProcessStatus = TTTS.GMONotificationUtil.PROCESS_STATUS_UNPROCESSED;
        debug('finding notification...');
        const notification = yield TTTS.Models.GMONotification.findOneAndUpdate({ process_status: TTTS.GMONotificationUtil.PROCESS_STATUS_UNPROCESSED }, { process_status: TTTS.GMONotificationUtil.PROCESS_STATUS_PROCESSING }, { new: true }).exec();
        debug('notification found.', notification);
        if (notification !== null) {
            try {
                // 内容の整合性チェック
                debug('finding reservations...payment_no:', notification.get('order_id'));
                const parsedOrderId = TTTS.ReservationUtil.parseGMOOrderId(notification.get('order_id'));
                const reservations = yield TTTS.Models.Reservation.find({
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
                    if (notification.get('pay_type') === gmo_service_1.Util.PAY_TYPE_CREDIT) {
                        switch (notification.get('status')) {
                            case gmo_service_1.Util.STATUS_CREDIT_UNPROCESSED:
                            case gmo_service_1.Util.STATUS_CREDIT_CAPTURE:
                            case gmo_service_1.Util.STATUS_CREDIT_AUTHENTICATED:
                            case gmo_service_1.Util.STATUS_CREDIT_CHECK:
                            case gmo_service_1.Util.STATUS_CREDIT_AUTH:
                            case gmo_service_1.Util.STATUS_CREDIT_SALES:
                            case gmo_service_1.Util.STATUS_CREDIT_RETURN:
                            case gmo_service_1.Util.STATUS_CREDIT_RETURNX:
                            case gmo_service_1.Util.STATUS_CREDIT_SAUTH:
                                // 何もしない
                                break;
                            case gmo_service_1.Util.STATUS_CREDIT_VOID:// 取消し
                                // 空席に戻さない(つくったけれども、連動しない方向で仕様決定)
                                break;
                            default:
                                // 何もしない
                                break;
                        }
                    }
                    else if (notification.get('pay_type') === gmo_service_1.Util.PAY_TYPE_CVS) {
                        switch (notification.get('status')) {
                            case gmo_service_1.Util.STATUS_CVS_PAYSUCCESS:
                                // 予約完了ステータスへ変更
                                debug('updating reservations by paymentNo...', notification.get('order_id'));
                                yield TTTS.Models.Reservation.update({ gmo_order_id: notification.get('order_id') }, {
                                    status: TTTS.ReservationUtil.STATUS_RESERVED,
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
                            case gmo_service_1.Util.STATUS_CVS_REQSUCCESS:
                                // GMOパラメータを予約に追加
                                debug('updating reservations by paymentNo...', notification.get('order_id'));
                                rawUpdateReservation = yield TTTS.Models.Reservation.update({ payment_no: notification.get('order_id') }, {
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
                            case gmo_service_1.Util.STATUS_CVS_UNPROCESSED:
                                // 何もしない
                                break;
                            case gmo_service_1.Util.STATUS_CVS_PAYFAIL: // 決済失敗
                            case gmo_service_1.Util.STATUS_CVS_CANCEL:// 支払い停止
                                // 空席に戻す
                                debug('removing reservations...gmo_order_id:', notification.get('order_id'));
                                yield Promise.all(reservations.map((reservation) => __awaiter(this, void 0, void 0, function* () {
                                    debug('removing reservation...', reservation.get('_id'));
                                    yield reservation.remove();
                                    debug('reservation removed.', reservation.get('_id'));
                                })));
                                break;
                            case gmo_service_1.Util.STATUS_CVS_EXPIRED:// 期限切れ
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
                notificationProcessStatus = TTTS.GMONotificationUtil.PROCESS_STATUS_PROCESSED;
            }
            catch (error) {
                console.error(error);
            }
            // 処理ステータス変更
            yield TTTS.Models.GMONotification.findByIdAndUpdate(notification.get('_id'), { process_status: notificationProcessStatus }).exec();
        }
    });
}
exports.processOne = processOne;
/**
 *GMO実売上
 */
// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
function settleGMOAuth() {
    return __awaiter(this, void 0, void 0, function* () {
        const reservation = yield TTTS.Models.Reservation.findOneAndUpdate({
            status: TTTS.ReservationUtil.STATUS_RESERVED,
            gmo_status: gmo_service_1.Util.STATUS_CREDIT_AUTH,
            payment_method: gmo_service_1.Util.PAY_TYPE_CREDIT,
            payment_seat_index: 0
        }, { gmo_status: TTTS.GMONotificationUtil.PROCESS_STATUS_PROCESSING }).exec();
        if (reservation !== null) {
            let searchArgin = {
                shopId: process.env.GMO_SHOP_ID,
                shopPass: process.env.GMO_SHOP_PASS,
                orderId: reservation.get('gmo_order_id')
            };
            // 取引状態参照
            const searchTradeResult = yield GMO.CreditService.searchTrade(searchArgin);
            if (searchTradeResult.jobCd === gmo_service_1.Util.JOB_CD_SALES) {
                // すでに実売上済み
                return;
            }
            // チェック文字列
            let shopPassString = gmo_service_1.Util.createShopPassString({
                shopId: process.env.GMO_SHOP_ID,
                orderId: reservation.get('gmo_order_id'),
                amount: +searchTradeResult.amount,
                shopPass: process.env.GMO_SHOP_PASS,
                dateTime: moment(reservation.get('purchased_at')).format('YYYYMMDDHHmmss')
            });
            if (shopPassString !== reservation.get('gmo_shop_pass_string')) {
                // TODO
                return;
            }
            try {
                yield GMO.CreditService.alterTran({
                    shopId: process.env.GMO_SHOP_ID,
                    shopPass: process.env.GMO_SHOP_PASS,
                    accessId: searchTradeResult.accessId,
                    accessPass: searchTradeResult.accessPass,
                    jobCd: gmo_service_1.Util.JOB_CD_SALES,
                    amount: parseInt(searchTradeResult.amount)
                });
            }
            catch (error) {
                console.log(error);
                return;
            }
            yield TTTS.Models.Reservation.findOneAndUpdate({ _id: reservation._id }, {
                $set: { gmo_status: gmo_service_1.Util.STATUS_CREDIT_SALES }
            }).exec();
        }
    });
}
exports.settleGMOAuth = settleGMOAuth;
