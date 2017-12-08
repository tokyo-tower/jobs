/**
 * GMOタスクコントローラー
 *
 * @namespace controller/gmo
 */
//EmailQueueUtil,
import { EmailQueueUtil, Models, PerformanceUtil, ReservationUtil, TicketTypeGroupUtil } from '@motionpicture/ttts-domain';

import { Util as GMOUtil } from '@motionpicture/gmo-service';
import * as GMO from '@motionpicture/gmo-service';
import * as TTTS from '@motionpicture/ttts-domain';

import * as conf from 'config';
import * as createDebug from 'debug';
import * as numeral from 'numeral';
// tslint:disable-next-line:no-require-imports
import moment = require('moment');

const debug = createDebug('ttts-jobs:controller:gmo');
const DEFAULT_RADIX = 10;

// 返金キャンセル料(0円)
const CANCEL_CHARGE_REFUND : number = 0;

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
 * GMO実売上
 */
// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
export async function settleGMOAuth() {
    const reservation = await TTTS.Models.Reservation.findOneAndUpdate({
        status: TTTS.ReservationUtil.STATUS_RESERVED,
        gmo_status: GMOUtil.STATUS_CREDIT_AUTH,
        payment_method: GMOUtil.PAY_TYPE_CREDIT,
        payment_seat_index: 0
    },
        // tslint:disable-next-line:align
        {gmo_status: TTTS.GMONotificationUtil.PROCESS_STATUS_PROCESSING}
    ).exec();
    if (reservation !== null) {
        const searchArgin : GMO.services.credit.ISearchTradeArgs = {
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
        const shopPassString = GMOUtil.createShopPassString({
            shopId: <string>process.env.GMO_SHOP_ID,
            orderId: reservation.get('gmo_order_id'),
            amount: +searchTradeResult.amount,
            shopPass: <string>process.env.GMO_SHOP_PASS,
            dateTime: moment(reservation.get('purchased_at')).format('YYYYMMDDHHmmss')
        });

        if (shopPassString !== reservation.get('gmo_shop_pass_string')) {
            // tslint:disable-next-line:no-suspicious-comment
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
                amount: parseInt(searchTradeResult.amount, DEFAULT_RADIX)
            });
        } catch (error) {
            // tslint:disable-next-line:no-console
            console.log(error);

            return;
        }

        await TTTS.Models.Reservation.findOneAndUpdate(
            { _id: reservation._id },
            {
                $set: { gmo_status: GMOUtil.STATUS_CREDIT_SALES,
                        gmo_tran_date: moment().format('YYYYMMDD') }
            }
        ).exec();
    }
}

/**
 * GMO返金(エレベータ運用停止の対応)
 */
export async function refundForSuspend() {

    // 対象パフォーマンス取得
    // targrtInfoByPayment: {'20171201_12345': [r1,r2,,,rn]}
    const info = await getRefundReservations();
    const reservationInfo = info.targrtInfoByPayment;

    const now = moment().format('YYYY/MM/DD HH:mm:ss');
    const performanceInfo: any = {};

    // GMO返金処理(購入単位)
    for ( const key of Object.keys(reservationInfo)) {
        const reservation = reservationInfo[key][0];
        // 取引状態参照
        const searchResult = await GMO.CreditService.searchTrade({
            shopId: <string>process.env.GMO_SHOP_ID,
            shopPass: <string>process.env.GMO_SHOP_PASS,
            orderId: <string>reservation.gmo_order_id
        });

        // 返金済ではない時(リトライ時エラーにならないためのIf分)
        if (searchResult.status !== GMO.Util.JOB_CD_RETURN) {
            // 決済取り消し(返品)処理
            await GMO.CreditService.alterTran({
                shopId: <string>process.env.GMO_SHOP_ID,
                shopPass: <string>process.env.GMO_SHOP_PASS,
                accessId: <string>reservation.gmo_access_id,
                accessPass: <string>reservation.gmo_access_pass,
                jobCd: GMO.Util.JOB_CD_RETURN
            });
            // パフォーマンス単位の返金数セット
            if (performanceInfo.hasOwnProperty(reservation.performance) === false) {
                // ※リトライ前提なら初期値は0ではなく、パフォーマンスから現在の返金済数を取得する必要あり
                performanceInfo[reservation.performance] = await getPerformanceRefundCount(reservation.performance);
            }
            // +1は購入数、lengthはレコード数
            //performanceInfo[reservation.performance] += 1;
            performanceInfo[reservation.performance] += getRefundCount(reservationInfo[key]);
            // 返金メール作成
            await createEmail(reservationInfo[key]);
        }

        // キャンセルリクエスト保管(返金情報は'3'(返金完了)に更新)
        const reservationNew = reservationInfo[key][0];
        reservationNew.performance_ttts_extension.refund_status = PerformanceUtil.REFUND_STATUS.COMPLETE;
        reservationNew.performance_ttts_extension.refund_update_at = now;
        await createCustomerCancelRequest(reservationNew, reservationInfo[key]);

        // 予約データクリア
        await clearReservation(reservationInfo[key]);
    }
    // パフォーマンスに返金状態、返金済み数を更新
    for ( const performanceId of Object.keys(performanceInfo)) {
        const paymentCount : number = performanceInfo[performanceId];
        // パフォーマンス更新
        await Models.Performance.findOneAndUpdate(
            {
                _id: performanceId
            },
            {
                $set: {
                    'ttts_extension.refunded_count': paymentCount,
                    'ttts_extension.refund_status' : PerformanceUtil.REFUND_STATUS.COMPLETE,
                    'ttts_extension.refund_update_at': now
                }
            }
        ).exec();
    }
}
/**
 * 返金対象予約情報取得
 *
 *  info: {
 *     targrtInfoByPayment: {'20171201_12345': [r1,r2,,,rn]}
 * }
 *
 * @return {any}
 */
async function getRefundReservations(): Promise<any> {
    let info: any = null;

    // 返金対象予約取得(一般予約かつ返金ステータスが指示済)
    const reservations = await Models.Reservation.find(
        {
            purchaser_group: ReservationUtil.PURCHASER_GROUP_CUSTOMER,
            'performance_ttts_extension.refund_status': PerformanceUtil.REFUND_STATUS.INSTRUCTED
        }
    ).exec();

    // 入塔済の予約情報セット
    const arrivedInfos: any[] = [];
    reservations.map((reservation: any) => {
        // 入塔済情報 [{performance_day:'20171201', payment_no:'12345'}]
        if (reservation.checkins.length > 0) {
            arrivedInfos.push({ performance_day: reservation.performance_day,
                                payment_no: reservation.payment_no});
        }
    });

    // 入塔済判定
    const isArrived = (reservation: any): boolean => {
        for (const arrivedInfo of arrivedInfos) {
            if (arrivedInfo.performance_day === reservation.performance_day &&
                arrivedInfo.payment_no === reservation.payment_no) {
                    return true;
            }
        }

        return false;
    };

    // 更新対象の予約IDセット
    const targrtInfoByPayment: any = {};
    //const targrtInfoByPerformance: any[] = [];
    reservations.map((reservation: any) => {
        // 入塔記録がない時
        if (isArrived(reservation) === false) {
            // 返金対象(購入単位) [{'20171201_12345': [r1,r2,,,rn]}]
            const key : string = `${reservation.performance_day}_${reservation.payment_no}`;
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
}
/**
 * 現在のパフォーマンスにセットされている返金数取得
 *
 * @return {number}
 */
async function getPerformanceRefundCount (performanceId: string) : Promise<any> {
    // パフォーマンス更新
    const performance = await Models.Performance.findById(
        {
            _id: performanceId
        }
    ).exec();

    return performance !== null ? (<any>performance).ttts_extension.refunded_count : 0;
}
/**
 * 返金予約数取得
 *   (車椅子チケットは4レコードで1予約)
 *
 * @return {number}
 */
function getRefundCount (reservations: any[]) : number {
    let count: number = 0;
    for (const reservation of reservations) {
        if (reservation.status === ReservationUtil.STATUS_RESERVED) {
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
async function createEmail(reservations: any[]) : Promise<void> {

    if (reservations === null) {

        return;
    }
    const reservation = reservations[0];
    // 本文編集(日本語)
    const infoJa = getEmailMessages(reservation, 'ja');
    const contentJa: string = `${infoJa.titleEmail}\n\n${infoJa.purchaserName}\n\n${infoJa.messageInfos.join('\n')}`;
    // 本文編集(英語)
    const infoEn = getEmailMessages(reservation, 'en');
    const contentEn: string = `${infoEn.titleEmail}\n\n${infoEn.purchaserName}\n\n${infoEn.messageInfos.join('\n')}`;
    const line: string = '--------------------------------------------------';
    // メール編集
    const emailQueue = {
        from: {
            address: conf.get<string>('email.from'),
            name: conf.get<string>('email.fromname')
        },
        to: {
            address: reservation.purchaser_email
        },
        subject: `${infoJa.title} ${infoJa.titleEmail} (${infoEn.title} ${infoEn.titleEmail})`,
        content: {
            mimetype: 'text/plain',
            text: `${contentJa}\n\n${line}\n${contentEn}`
        },
        status: EmailQueueUtil.STATUS_UNSENT
    };

    // メール作成
    await Models.EmailQueue.create(emailQueue);
}
/**
 * メールメッセージ取得
 *
 * @param {any} reservation
 * @param {any} locale
 * @return {any}
 */
function getEmailMessages(reservation: any,
                          locale: string) : any {
    // 購入者氏名
    const purchaserName: string = reservation.purchaser_name[locale];
    // 入塔日
    const day: string = moment(reservation.performance_day, 'YYYYMMDD').format('YYYY/MM/DD');
    // tslint:disable-next-line:no-magic-numbers
    const time: string = `${reservation.performance_start_time.substr(0, 2)}:${reservation.performance_start_time.substr(2, 2)}`;
    // 返金額
    const amount: string = numeral(reservation.gmo_amount).format('0,0');

    // 返金メールメッセージ
    const messages : string[] = conf.get<string[]>(`emailRefund.${locale}.messages`);
    // 購入チケット情報
    const messageInfos: string[] = [];
    for (const message of messages) {
        let editMessage: string = message;
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
        title: conf.get<string>(`emailRefund.${locale}.title`),
        // 返金のお知らせ
        titleEmail: conf.get<string>(`emailRefund.${locale}.titleEmail`),
        //トウキョウ タロウ 様
        purchaserName: conf.get<string>(`emailRefund.${locale}.destinationName`).replace('$purchaser_name$', purchaserName),
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
async function clearReservation(reservations: any[]) : Promise<void> {

    const promises = ((<any>reservations).map(async(reservation: any) => {

        // 本体チケットかつ特殊チケットの時、時間ごとの予約データ解放(AVAILABLEに変更)
        if (reservation.ticket_ttts_extension.category !== TicketTypeGroupUtil.TICKET_TYPE_CATEGORY_NORMAL &&
            reservation.seat_code === reservation.reservation_ttts_extension.seat_code_base) {
            await Models.ReservationPerHour.findOneAndUpdate(
                { reservation_id: reservation._id.toString() },
                {
                    $set: {status: ReservationUtil.STATUS_AVAILABLE},
                    $unset: {expired_at: 1, reservation_id: 1}
                },
                { new: true }
            ).exec();
            //logger.info('ReservationPerHour clear reservation_id=', reservation._id.toString());
        }
        // 予約データ解放(AVAILABLEに変更)
        await Models.Reservation.findByIdAndUpdate(
            reservation._id,
            {
                $set: { status: ReservationUtil.STATUS_AVAILABLE },
                $unset: getUnsetFields(reservation._doc)
            }
        ).exec();
    }));
    await Promise.all(promises);
}
/**
 * 更新時削除フィールド取得
 *
 * @param {any} reservation
 * @return {any} unset
 */
function getUnsetFields(reservation: any): any {
    const setFields: string[] = [
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
            (<any>unset)[propertyName] = 1;
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
async function createCustomerCancelRequest(reservationNew: any,
                                           reservations: any[]) : Promise<void> {

    await Models.CustomerCancelRequest.create({
        reservation: reservationNew,
        tickets: (<any>Models.CustomerCancelRequest).getTickets(reservations),
        cancel_name: `${reservationNew.purchaser_last_name} ${reservationNew.purchaser_first_name}`,
        cancellation_fee: CANCEL_CHARGE_REFUND
    });
}
