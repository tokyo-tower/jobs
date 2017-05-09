/**
 * 座席予約タスクコントローラー
 *
 * @namespace ReservationController
 */

import { Util as GMOUtil } from '@motionpicture/gmo-service';
import { Models, ReservationUtil } from '@motionpicture/ttts-domain';

import * as conf from 'config';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as querystring from 'querystring';
import * as request from 'request';

const debug = createDebug('ttts-jobs:controller:reservation');

/**
 * 仮予約ステータスで、一定時間過ぎた予約を空席にする
 *
 * @memberOf ReservationController
 */
export async function removeTmps(): Promise<void> {
    const BUFFER_PERIOD_SECONDS = -60;
    debug('removing temporary reservations...');
    await Models.Reservation.remove(
        {
            status: ReservationUtil.STATUS_TEMPORARY,
            expired_at: {
                // 念のため、仮予約有効期間より1分長めにしておく
                $lt: moment().add(BUFFER_PERIOD_SECONDS, 'seconds').toISOString()
            }
        }
    ).exec();
    debug('temporary reservations removed.');

    // 失敗しても、次のタスクにまかせる(気にしない)
}

/**
 * TTTS確保上の仮予約をTTTS確保へ戻す
 *
 * @memberOf ReservationController
 */
export async function tmp2ttts(): Promise<void> {
    const BUFFER_PERIOD_SECONDS = -60;
    const ids = await Models.Reservation.distinct(
        '_id',
        {
            status: ReservationUtil.STATUS_TEMPORARY_ON_KEPT_BY_TTTS,
            expired_at: {
                // 念のため、仮予約有効期間より1分長めにしておく
                $lt: moment().add(BUFFER_PERIOD_SECONDS, 'seconds').toISOString()
            }
        }
    ).exec();

    await Promise.all(ids.map(async (id) => {
        await Models.Reservation.findByIdAndUpdate(
            id,
            { status: ReservationUtil.STATUS_KEPT_BY_TTTS }
        ).exec();
    }));
}

/**
 * 固定日時を経過したら、空席ステータスにするバッチ
 *
 * @memberOf ReservationController
 */
export async function releaseSeatsKeptByMembers() {
    if (moment(conf.get<string>('datetimes.reservation_end_members')) < moment()) {
        // 空席にする場合はこちら
        debug('releasing reservations kept by members...');
        await Models.Reservation.remove(
            {
                status: ReservationUtil.STATUS_KEPT_BY_MEMBER
            }
        ).exec();

        // 失敗しても、次のタスクにまかせる(気にしない)
    }
}

/**
 * GMO離脱データを解放する(内部確保)
 * todo 空席に変更する仕様に変更
 *
 * @memberOf ReservationController
 */
export async function releaseGarbages(): Promise<void> {
    // 一定期間WAITING_SETTLEMENTの予約を抽出
    const WAITING_PERIOD_HOURS = -2;
    const reservations = await Models.Reservation.find(
        {
            status: ReservationUtil.STATUS_WAITING_SETTLEMENT,
            updated_at: { $lt: moment().add(WAITING_PERIOD_HOURS, 'hours').toISOString() }
        }
    ).exec();

    const paymentNos4release: string[] = [];
    const gmoUrl = (process.env.NODE_ENV === 'production') ?
        'https://p01.mul-pay.jp/payment/SearchTradeMulti.idPass' :
        'https://pt01.mul-pay.jp/payment/SearchTradeMulti.idPass';

    const promises = reservations.map(async (reservation) => {
        // GMO取引状態参照
        debug('requesting... ');
        request.post(
            {
                url: gmoUrl,
                form: {
                    ShopID: process.env.GMO_SHOP_ID,
                    ShopPass: process.env.GMO_SHOP_PASS,
                    OrderID: reservation.get('gmo_order_id'),
                    PayType: reservation.get('payment_method')
                }
            },
            (error, response, body) => {
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
                } else {
                    if (searchTradeResult.Status === GMOUtil.STATUS_CVS_UNPROCESSED ||
                        searchTradeResult.Status === GMOUtil.STATUS_CREDIT_UNPROCESSED) {
                        paymentNos4release.push(reservation.get('payment_no'));
                    }
                }
            }
        );
    });

    await Promise.all(promises);
    debug('promised.');

    if (paymentNos4release.length === 0) {
        return;
    }

    // 予約削除
    debug('updating reservations...');
    await Models.Reservation.remove(
        {
            payment_no: { $in: paymentNos4release }
        }
    ).exec();
}
