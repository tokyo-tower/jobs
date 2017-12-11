/**
 * GMOタスクコントローラー
 *
 * @namespace controller/gmo
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as conf from 'config';
import * as createDebug from 'debug';
import * as  moment from 'moment';
import * as numeral from 'numeral';

const debug = createDebug('ttts-jobs:controller:gmo');
const DEFAULT_RADIX = 10;

// 返金キャンセル料(0円)
const CANCEL_CHARGE_REFUND: number = 0;

/**
 * GMO結果通知を処理する
 * @memberof controller/gmo
 */
// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
export async function processOne() {
    // 最終的に通知にセットする処理ステータス
    let notificationProcessStatus: string = ttts.GMONotificationUtil.PROCESS_STATUS_UNPROCESSED;

    debug('finding notification...');
    const notification = await ttts.Models.GMONotification.findOneAndUpdate(
        { process_status: ttts.GMONotificationUtil.PROCESS_STATUS_UNPROCESSED },
        { process_status: ttts.GMONotificationUtil.PROCESS_STATUS_PROCESSING },
        { new: true }
    ).exec();
    debug('notification found.', notification);

    const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);

    if (notification !== null) {
        try {
            // 内容の整合性チェック
            debug('finding reservations...payment_no:', notification.get('order_id'));
            const parsedOrderId = ttts.ReservationUtil.parseGMOOrderId(notification.get('order_id'));
            const reservations = await reservationRepo.reservationModel.find(
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

                        case ttts.GMO.utils.util.Status.Void: // 取消し
                            // 空席に戻さない(つくったけれども、連動しない方向で仕様決定)
                            break;

                        default:
                            // 何もしない
                            break;
                    }
                } else if (notification.get('pay_type') === ttts.GMO.utils.util.PayType.Cvs) {
                    // no op
                } else {
                    // 他の決済は本案件では非対応なので何もしない
                }
            }

            // 処理済みに
            notificationProcessStatus = ttts.GMONotificationUtil.PROCESS_STATUS_PROCESSED;
        } catch (error) {
            console.error(error);
        }

        // 処理ステータス変更
        await ttts.Models.GMONotification.findByIdAndUpdate(
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
    const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);

    const reservation = await reservationRepo.reservationModel.findOneAndUpdate({
        status: ttts.factory.reservationStatusType.ReservationConfirmed,
        gmo_status: ttts.GMO.utils.util.Status.Auth,
        payment_method: ttts.GMO.utils.util.PayType.Credit,
        payment_seat_index: 0
    },
        // tslint:disable-next-line:align
        { gmo_status: ttts.GMONotificationUtil.PROCESS_STATUS_PROCESSING }
    ).exec();
    if (reservation !== null) {
        const searchArgin: ttts.GMO.services.credit.ISearchTradeArgs = {
            shopId: <string>process.env.GMO_SHOP_ID,
            shopPass: <string>process.env.GMO_SHOP_PASS,
            orderId: reservation.get('gmo_order_id')
        };
        // 取引状態参照
        const searchTradeResult = await ttts.GMO.services.credit.searchTrade(searchArgin);

        if (searchTradeResult.jobCd === ttts.GMO.utils.util.JobCd.Sales) {
            // すでに実売上済み
            return;
        }

        // チェック文字列
        const shopPassString = ttts.GMO.utils.util.createShopPassString({
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
            await ttts.GMO.services.credit.alterTran({
                shopId: <string>process.env.GMO_SHOP_ID,
                shopPass: <string>process.env.GMO_SHOP_PASS,
                accessId: searchTradeResult.accessId,
                accessPass: searchTradeResult.accessPass,
                jobCd: ttts.GMO.utils.util.JobCd.Sales,
                amount: parseInt(searchTradeResult.amount, DEFAULT_RADIX)
            });
        } catch (error) {
            // tslint:disable-next-line:no-console
            console.log(error);

            return;
        }

        await reservationRepo.reservationModel.findOneAndUpdate(
            { _id: reservation._id },
            {
                $set: {
                    gmo_status: ttts.GMO.utils.util.Status.Sales,
                    gmo_tran_date: moment().format('YYYYMMDD')
                }
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
    for (const key of Object.keys(reservationInfo)) {
        const reservation = reservationInfo[key][0];
        // 取引状態参照
        const searchResult = await ttts.GMO.services.credit.searchTrade({
            shopId: <string>process.env.GMO_SHOP_ID,
            shopPass: <string>process.env.GMO_SHOP_PASS,
            orderId: <string>reservation.gmo_order_id
        });

        // 返金済ではない時(リトライ時エラーにならないためのIf分)
        if (searchResult.status !== ttts.GMO.utils.util.JobCd.Return) {
            // 決済取り消し(返品)処理
            await ttts.GMO.services.credit.alterTran({
                shopId: <string>process.env.GMO_SHOP_ID,
                shopPass: <string>process.env.GMO_SHOP_PASS,
                accessId: <string>reservation.gmo_access_id,
                accessPass: <string>reservation.gmo_access_pass,
                jobCd: ttts.GMO.utils.util.JobCd.Return
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
        reservationNew.performance_ttts_extension.refund_status = ttts.PerformanceUtil.REFUND_STATUS.COMPLETE;
        reservationNew.performance_ttts_extension.refund_update_at = now;
        await createCustomerCancelRequest(reservationNew, reservationInfo[key]);

        // 予約データクリア
        await clearReservation(reservationInfo[key]);
    }
    // パフォーマンスに返金状態、返金済み数を更新
    for (const performanceId of Object.keys(performanceInfo)) {
        const paymentCount: number = performanceInfo[performanceId];
        // パフォーマンス更新
        await ttts.Models.Performance.findOneAndUpdate(
            {
                _id: performanceId
            },
            {
                $set: {
                    'ttts_extension.refunded_count': paymentCount,
                    'ttts_extension.refund_status': ttts.PerformanceUtil.REFUND_STATUS.COMPLETE,
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
    const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);

    let info: any = null;

    // 返金対象予約取得(一般予約かつ返金ステータスが指示済)
    const reservations = await reservationRepo.reservationModel.find(
        {
            purchaser_group: ttts.ReservationUtil.PURCHASER_GROUP_CUSTOMER,
            'performance_ttts_extension.refund_status': ttts.PerformanceUtil.REFUND_STATUS.INSTRUCTED
        }
    ).exec();

    // 入塔済の予約情報セット
    const arrivedInfos: any[] = [];
    reservations.map((reservation: any) => {
        // 入塔済情報 [{performance_day:'20171201', payment_no:'12345'}]
        if (reservation.checkins.length > 0) {
            arrivedInfos.push({
                performance_day: reservation.performance_day,
                payment_no: reservation.payment_no
            });
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
            const key: string = `${reservation.performance_day}_${reservation.payment_no}`;
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
async function getPerformanceRefundCount(performanceId: string): Promise<any> {
    // パフォーマンス更新
    const performance = await ttts.Models.Performance.findById(
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
function getRefundCount(reservations: any[]): number {
    let count: number = 0;
    for (const reservation of reservations) {
        if (reservation.status === ttts.factory.reservationStatusType.ReservationConfirmed) {
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
async function createEmail(reservations: any[]): Promise<void> {

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
        status: ttts.EmailQueueUtil.STATUS_UNSENT
    };

    // メール作成
    await ttts.Models.EmailQueue.create(emailQueue);
}
/**
 * メールメッセージ取得
 *
 * @param {any} reservation
 * @param {any} locale
 * @return {any}
 */
function getEmailMessages(reservation: any, locale: string): any {
    // 購入者氏名
    const purchaserName: string = reservation.purchaser_name[locale];
    // 入塔日
    const day: string = moment(reservation.performance_day, 'YYYYMMDD').format('YYYY/MM/DD');
    // tslint:disable-next-line:no-magic-numbers
    const time: string = `${reservation.performance_start_time.substr(0, 2)}:${reservation.performance_start_time.substr(2, 2)}`;
    // 返金額
    const amount: string = numeral(reservation.gmo_amount).format('0,0');

    // 返金メールメッセージ
    const messages: string[] = conf.get<string[]>(`emailRefund.${locale}.messages`);
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
async function clearReservation(reservations: any[]): Promise<void> {
    const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection);

    const promises = ((<any>reservations).map(async (reservation: any) => {

        // 本体チケットかつ特殊チケットの時、時間ごとの予約データ解放(AVAILABLEに変更)
        if (reservation.ticket_ttts_extension.category !== ttts.TicketTypeGroupUtil.TICKET_TYPE_CATEGORY_NORMAL &&
            reservation.seat_code === reservation.reservation_ttts_extension.seat_code_base) {
            await ttts.Models.ReservationPerHour.findOneAndUpdate(
                { reservation_id: reservation._id.toString() },
                {
                    $set: { status: ttts.factory.itemAvailability.InStock },
                    $unset: { expired_at: 1, reservation_id: 1 }
                },
                { new: true }
            ).exec();
            //logger.info('ReservationPerHour clear reservation_id=', reservation._id.toString());
        }

        // 予約データ解放(AVAILABLEに変更)
        await reservationRepo.reservationModel.findByIdAndUpdate(
            reservation._id,
            {
                status: ttts.factory.reservationStatusType.ReservationCancelled
            }
        ).exec();

        // tslint:disable-next-line:no-suspicious-comment
        // TODO 在庫を有に変更
    }));
    await Promise.all(promises);
}

/**
 * キャンセルリクエスト保管
 *
 * @param {any} reservationNew
 * @param {any} reservations
 * @return {Promise<void>}
 */
async function createCustomerCancelRequest(reservationNew: any, reservations: any[]): Promise<void> {

    await ttts.Models.CustomerCancelRequest.create({
        reservation: reservationNew,
        tickets: (<any>ttts.Models.CustomerCancelRequest).getTickets(reservations),
        cancel_name: `${reservationNew.purchaser_last_name} ${reservationNew.purchaser_first_name}`,
        cancellation_fee: CANCEL_CHARGE_REFUND
    });
}
