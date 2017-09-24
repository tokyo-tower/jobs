/**
 * GMOタスクコントローラー
 *
 * @namespace controller/gmo
 */

import { Util as GMOUtil } from '@motionpicture/gmo-service';
import * as GMO from '@motionpicture/gmo-service';
import * as TTTS from '@motionpicture/ttts-domain';

import * as createDebug from 'debug';
import moment = require('moment');

const debug = createDebug('ttts-jobs:controller:gmo');

/**
 * GMO結果通知を処理する
 *
 * @memberOf controller/gmo
 */
// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
export async function processOne() {
    // 最終的に通知にセットする処理ステータス
    let notificationProcessStatus: string = TTTS.GMONotificationUtil.PROCESS_STATUS_UNPROCESSED;

    debug('finding notification...');
    const notification = await TTTS.Models.GMONotification.findOneAndUpdate(
        { process_status: TTTS.GMONotificationUtil.PROCESS_STATUS_UNPROCESSED },
        { process_status: TTTS.GMONotificationUtil.PROCESS_STATUS_PROCESSING },
        { new: true }
    ).exec();
    debug('notification found.', notification);

    if (notification !== null) {
        try {
            // 内容の整合性チェック
            debug('finding reservations...payment_no:', notification.get('order_id'));
            const parsedOrderId = TTTS.ReservationUtil.parseGMOOrderId(notification.get('order_id'));
            const reservations = await TTTS.Models.Reservation.find(
                {
                    performance_day: parsedOrderId.performanceDay,
                    payment_no: parsedOrderId.paymentNo
                }
            ).exec();
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
                let rawUpdateReservation: any;
                if (notification.get('pay_type') === GMOUtil.PAY_TYPE_CREDIT) {
                    switch (notification.get('status')) {
                        case GMOUtil.STATUS_CREDIT_UNPROCESSED:
                        case GMOUtil.STATUS_CREDIT_CAPTURE:
                        case GMOUtil.STATUS_CREDIT_AUTHENTICATED:
                        case GMOUtil.STATUS_CREDIT_CHECK:
                        case GMOUtil.STATUS_CREDIT_AUTH:
                        case GMOUtil.STATUS_CREDIT_SALES:
                        case GMOUtil.STATUS_CREDIT_RETURN:
                        case GMOUtil.STATUS_CREDIT_RETURNX:
                        case GMOUtil.STATUS_CREDIT_SAUTH:
                            // 何もしない
                            break;

                        case GMOUtil.STATUS_CREDIT_VOID: // 取消し
                            // 空席に戻さない(つくったけれども、連動しない方向で仕様決定)
                            break;

                        default:
                            // 何もしない
                            break;
                    }
                } else if (notification.get('pay_type') === GMOUtil.PAY_TYPE_CVS) {
                    switch (notification.get('status')) {
                        case GMOUtil.STATUS_CVS_PAYSUCCESS:
                            // 予約完了ステータスへ変更
                            debug('updating reservations by paymentNo...', notification.get('order_id'));
                            await TTTS.Models.Reservation.update(
                                { gmo_order_id: notification.get('order_id') },
                                {
                                    status: TTTS.ReservationUtil.STATUS_RESERVED,
                                    updated_user: 'system'
                                },
                                { multi: true }
                            ).exec();
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

                        case GMOUtil.STATUS_CVS_REQSUCCESS:
                            // GMOパラメータを予約に追加
                            debug('updating reservations by paymentNo...', notification.get('order_id'));
                            rawUpdateReservation = await TTTS.Models.Reservation.update(
                                { payment_no: notification.get('order_id') },
                                {
                                    gmo_shop_id: notification.get('shop_id'),
                                    gmo_amount: notification.get('amount'),
                                    gmo_tax: notification.get('tax'),
                                    gmo_cvs_code: notification.get('cvs_code'),
                                    gmo_cvs_conf_no: notification.get('cvs_conf_no'),
                                    gmo_cvs_receipt_no: notification.get('cvs_receipt_no'),
                                    gmo_payment_term: notification.get('payment_term'),
                                    updated_user: 'system'
                                },
                                { multi: true }
                            ).exec();
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

                        case GMOUtil.STATUS_CVS_UNPROCESSED:
                            // 何もしない
                            break;

                        case GMOUtil.STATUS_CVS_PAYFAIL: // 決済失敗
                        case GMOUtil.STATUS_CVS_CANCEL: // 支払い停止
                            // 空席に戻す
                            debug('removing reservations...gmo_order_id:', notification.get('order_id'));
                            await Promise.all(reservations.map(async (reservation) => {
                                debug('removing reservation...', reservation.get('_id'));
                                await reservation.remove();
                                debug('reservation removed.', reservation.get('_id'));
                            }));

                            break;

                        case GMOUtil.STATUS_CVS_EXPIRED: // 期限切れ
                            // 空席に戻す
                            debug('removing reservations...payment_no:', notification.get('order_id'));
                            const promises = reservations.map(async (reservation) => {
                                debug('removing reservation...', reservation.get('_id'));
                                await reservation.remove();
                                debug('reservation removed.', reservation.get('_id'));
                            });

                            await Promise.all(promises);

                            break;

                        default:
                            break;
                    }
                } else {
                    // 他の決済は本案件では非対応なので何もしない
                }
            }

            // 処理済みに
            notificationProcessStatus = TTTS.GMONotificationUtil.PROCESS_STATUS_PROCESSED;
        } catch (error) {
            console.error(error);
        }

        // 処理ステータス変更
        await TTTS.Models.GMONotification.findByIdAndUpdate(
            notification.get('_id'),
            { process_status: notificationProcessStatus }
        ).exec();
    }
}

/**
 *GMO実売上
 */
// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
export async function settleGMOAuth() {
    const reservation = await TTTS.Models.Reservation.findOneAndUpdate({
        status: TTTS.ReservationUtil.STATUS_RESERVED,
        gmo_status: GMOUtil.STATUS_CREDIT_AUTH,
        payment_method: GMOUtil.PAY_TYPE_CREDIT,
        payment_seat_index: 0
    },
        {gmo_status: TTTS.GMONotificationUtil.PROCESS_STATUS_PROCESSING}
    ).exec();
    
    if(reservation !== null){
        let searchArgin : GMO.services.credit.ISearchTradeArgs = {
            shopId: <string>process.env.GMO_SHOP_ID,
            shopPass: <string>process.env.GMO_SHOP_PASS,
            orderId: reservation.get('gmo_order_id')
        };
        // 取引状態参照
        const searchTradeResult = await GMO.CreditService.searchTrade(searchArgin);

        if (searchTradeResult.jobCd === GMOUtil.JOB_CD_SALES) {
            // すでに実売上済み
            return;
        }

        // チェック文字列
        let shopPassString = GMOUtil.createShopPassString({
            shopId: <string>process.env.GMO_SHOP_ID,
            orderId: reservation.get('gmo_order_id'),
            amount: +searchTradeResult.amount,
            shopPass: <string>process.env.GMO_SHOP_PASS,
            dateTime: moment(reservation.get('purchased_at')).format('YYYYMMDDHHmmss')
        });

        if (shopPassString !== reservation.get('gmo_shop_pass_string')) {
            // TODO
            return;
        }
        try {
            await GMO.CreditService.alterTran({
                shopId: <string>process.env.GMO_SHOP_ID,
                shopPass: <string>process.env.GMO_SHOP_PASS,
                accessId: searchTradeResult.accessId,
                accessPass: searchTradeResult.accessPass,
                jobCd: GMOUtil.JOB_CD_SALES,
                amount: parseInt(searchTradeResult.amount)
            });
        } catch (error) {
            console.log(error)
            return;
        }

        await TTTS.Models.Reservation.findOneAndUpdate(
            { _id: reservation._id },
            {
                $set: { gmo_status: GMOUtil.STATUS_CREDIT_SALES }
            }
        ).exec();
    }
}