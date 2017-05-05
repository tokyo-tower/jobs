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
const chevre = require("@motionpicture/chevre-domain");
const gmo_service_1 = require("@motionpicture/gmo-service");
const createDebug = require("debug");
const debug = createDebug('chevre-jobs:controller:gmo');
/**
 * GMO結果通知を処理する
 *
 * @memberOf controller/gmo
 */
// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
function processOne() {
    return __awaiter(this, void 0, void 0, function* () {
        // 最終的に通知にセットする処理ステータス
        let notificationProcessStatus = chevre.GMONotificationUtil.PROCESS_STATUS_UNPROCESSED;
        debug('finding notification...');
        const notification = yield chevre.Models.GMONotification.findOneAndUpdate({ process_status: chevre.GMONotificationUtil.PROCESS_STATUS_UNPROCESSED }, { process_status: chevre.GMONotificationUtil.PROCESS_STATUS_PROCESSING }, { new: true }).exec();
        debug('notification found.', notification);
        if (notification !== null) {
            try {
                // 内容の整合性チェック
                debug('finding reservations...payment_no:', notification.get('order_id'));
                const parsedOrderId = chevre.ReservationUtil.parseGMOOrderId(notification.get('order_id'));
                const reservations = yield chevre.Models.Reservation.find({
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
                            case gmo_service_1.Util.STATUS_CREDIT_VOID:
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
                                rawUpdateReservation = yield chevre.Models.Reservation.update({ payment_no: notification.get('order_id') }, {
                                    status: chevre.ReservationUtil.STATUS_RESERVED,
                                    updated_user: 'system'
                                }, { multi: true }).exec();
                                debug('reservations updated.', rawUpdateReservation);
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
                                rawUpdateReservation = yield chevre.Models.Reservation.update({ payment_no: notification.get('order_id') }, {
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
                            case gmo_service_1.Util.STATUS_CVS_CANCEL:
                                // 空席に戻す
                                debug('removing reservations...payment_no:', notification.get('order_id'));
                                const promises = reservations.map((reservation) => __awaiter(this, void 0, void 0, function* () {
                                    debug('removing reservation...', reservation.get('_id'));
                                    yield reservation.remove();
                                    debug('reservation removed.', reservation.get('_id'));
                                }));
                                yield Promise.all(promises);
                                break;
                            case gmo_service_1.Util.STATUS_CVS_EXPIRED:
                                // 内部で確保する仕様の場合
                                const staff = yield chevre.Models.Staff.findOne({
                                    user_id: '2016sagyo2'
                                }).exec();
                                debug('staff found.', staff);
                                debug('updating reservations...');
                                rawUpdateReservation = yield chevre.Models.Reservation.update({
                                    payment_no: notification.get('order_id')
                                }, {
                                    status: chevre.ReservationUtil.STATUS_RESERVED,
                                    purchaser_group: chevre.ReservationUtil.PURCHASER_GROUP_STAFF,
                                    charge: 0,
                                    ticket_type_charge: 0,
                                    ticket_type_name: {
                                        en: 'Free',
                                        ja: '無料'
                                    },
                                    ticket_type_code: '00',
                                    staff: staff.get('_id'),
                                    staff_user_id: staff.get('user_id'),
                                    staff_email: staff.get('email'),
                                    staff_name: staff.get('name'),
                                    staff_signature: 'system',
                                    updated_user: 'system',
                                    // "purchased_at": Date.now(), // 購入日更新しない
                                    watcher_name_updated_at: null,
                                    watcher_name: ''
                                }, {
                                    multi: true
                                }).exec();
                                debug('updated.', rawUpdateReservation);
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
                notificationProcessStatus = chevre.GMONotificationUtil.PROCESS_STATUS_PROCESSED;
            }
            catch (error) {
                console.error(error);
            }
            // 処理ステータス変更
            yield chevre.Models.GMONotification.findByIdAndUpdate(notification.get('_id'), { process_status: notificationProcessStatus }).exec();
        }
    });
}
exports.processOne = processOne;
