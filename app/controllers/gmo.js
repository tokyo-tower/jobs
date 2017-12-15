"use strict";
/**
 * GMOタスクコントローラー
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
const createDebug = require("debug");
const debug = createDebug('ttts-jobs:controller:gmo');
/**
 * GMO結果通知を処理する
 * @memberof controller/gmo
 */
function processOne() {
    return __awaiter(this, void 0, void 0, function* () {
        // 最終的に通知にセットする処理ステータス
        let notificationProcessStatus = ttts.GMONotificationUtil.PROCESS_STATUS_UNPROCESSED;
        debug('finding notification...');
        const notification = yield ttts.Models.GMONotification.findOneAndUpdate({ process_status: ttts.GMONotificationUtil.PROCESS_STATUS_UNPROCESSED }, { process_status: ttts.GMONotificationUtil.PROCESS_STATUS_PROCESSING }, { new: true }).exec();
        debug('notification found.', notification);
        const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);
        if (notification !== null) {
            try {
                // 内容の整合性チェック
                debug('finding reservations...payment_no:', notification.get('order_id'));
                const parsedOrderId = ttts.ReservationUtil.parseGMOOrderId(notification.get('order_id'));
                const reservations = yield reservationRepo.reservationModel.find({
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
                        // no op
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
