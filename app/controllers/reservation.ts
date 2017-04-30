/**
 * 座席予約タスクコントローラー
 *
 * @namespace ReservationController
 */

import { Models, ReservationUtil } from '@motionpicture/chevre-domain';
import { Util as GMOUtil } from '@motionpicture/gmo-service';

import * as conf from 'config';
import * as createDebug from 'debug';
import * as moment from 'moment';
import * as querystring from 'querystring';
import * as request from 'request';

const debug = createDebug('chevre-jobs:controller:reservation');

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
 * CHEVRE確保上の仮予約をCHEVRE確保へ戻す
 *
 * @memberOf ReservationController
 */
export async function tmp2chevre(): Promise<void> {
    const BUFFER_PERIOD_SECONDS = -60;
    const ids = await Models.Reservation.distinct(
        '_id',
        {
            status: ReservationUtil.STATUS_TEMPORARY_ON_KEPT_BY_CHEVRE,
            expired_at: {
                // 念のため、仮予約有効期間より1分長めにしておく
                $lt: moment().add(BUFFER_PERIOD_SECONDS, 'seconds').toISOString()
            }
        }
    ).exec();

    await Promise.all(ids.map(async (id) => {
        debug('updating to STATUS_KEPT_BY_CHEVRE...id:', id);
        await Models.Reservation.findByIdAndUpdate(
            id,
            { status: ReservationUtil.STATUS_KEPT_BY_CHEVRE }
        ).exec();
        debug('updated to STATUS_KEPT_BY_CHEVRE. id:', id);
    }));
}

/**
 * 固定日時を経過したら、空席ステータスにするバッチ
 *
 * @memberOf ReservationController
 */
// tslint:disable-next-line:max-func-body-length
export function releaseSeatsKeptByMembers() {
    if (moment(conf.get<string>('datetimes.reservation_end_members')) < moment()) {
        // 内部関係者で確保する
        Models.Staff.findOne(
            {
                user_id: '2016sagyo2'
            },
            async (err, staff) => {
                debug('staff found.', err, staff);
                if (err !== null) {
                    return;
                }

                const reservations = await Models.Reservation.find(
                    {
                        status: ReservationUtil.STATUS_KEPT_BY_MEMBER
                    }
                ).exec();

                const promises = reservations.map(async (reservation, index) => {
                    debug('finding performance...');
                    const performance = await Models.Performance.findOne({
                        _id: reservation.get('performance')
                    })
                        .populate('film', 'name is_mx4d copyright')
                        .populate('screen', 'name')
                        .populate('theater', 'name address')
                        .exec();

                    debug('updating reservation...');
                    // 購入番号発行
                    const paymentNo = await ReservationUtil.publishPaymentNo(performance.get('day'));
                    const raw = await reservation.update(
                        {
                            status: ReservationUtil.STATUS_RESERVED,
                            staff: staff.get('_id'),
                            staff_user_id: staff.get('user_id'),
                            staff_email: staff.get('email'),
                            staff_name: staff.get('name'),
                            staff_signature: 'system',
                            entered: false,
                            updated_user: 'system',
                            purchased_at: Date.now(),
                            watcher_name_updated_at: null,
                            watcher_name: '',
                            film_copyright: performance.get('film').get('copyright'),
                            film_is_mx4d: performance.get('film').get('is_mx4d'),
                            film_image: `${process.env.FRONTEND_ENDPOINT}/images/film/${performance.get('film').get('_id')}.jpg`,
                            film_name_en: performance.get('film').get('name.en'),
                            film_name_ja: performance.get('film').get('name.ja'),
                            film: performance.get('film').get('_id'),
                            screen_name_en: performance.get('screen').get('name.en'),
                            screen_name_ja: performance.get('screen').get('name.ja'),
                            screen: performance.get('screen').get('_id'),
                            theater_name_en: performance.get('theater').get('name.en'),
                            theater_name_ja: performance.get('theater').get('name.ja'),
                            theater_address_en: performance.get('theater').get('address.en'),
                            theater_address_ja: performance.get('theater').get('address.ja'),
                            theater: performance.get('theater').get('_id'),
                            performance_canceled: performance.get('canceled'),
                            performance_end_time: performance.get('end_time'),
                            performance_start_time: performance.get('start_time'),
                            performance_open_time: performance.get('open_time'),
                            performance_day: performance.get('day'),
                            purchaser_group: ReservationUtil.PURCHASER_GROUP_STAFF,
                            payment_no: paymentNo,
                            payment_seat_index: index,
                            charge: 0,
                            ticket_type_charge: 0,
                            ticket_type_name_en: 'Free',
                            ticket_type_name_ja: '無料',
                            ticket_type_code: '00',
                            seat_grade_additional_charge: 0,
                            seat_grade_name_en: 'Normal Seat',
                            seat_grade_name_ja: 'ノーマルシート'
                        }
                    ).exec();
                    debug('reservation updated.', raw);
                });

                await Promise.all(promises);
                debug('promised.', err);
            }
        );

        // 空席にする場合はこちら
        // debug('releasing reservations kept by members...');
        // Models.Reservation.remove(
        //     {
        //         status: ReservationUtil.STATUS_KEPT_BY_MEMBER
        //     },
        //     (err) => {
        //         // 失敗しても、次のタスクにまかせる(気にしない)
        //         if (err) {
        //         } else {
        //         }
        //     }
        // );
    } else {
        process.exit(0);
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
                    OrderID: reservation.get('payment_no'),
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

    // 内部で確保する仕様の場合
    const staff = await Models.Staff.findOne({ user_id: '2016sagyo2' }).exec();
    debug('staff found.', staff);

    debug('updating reservations...');
    await Models.Reservation.update(
        {
            payment_no: { $in: paymentNos4release }
        },
        {
            status: ReservationUtil.STATUS_RESERVED,
            purchaser_group: ReservationUtil.PURCHASER_GROUP_STAFF,

            charge: 0,
            ticket_type_charge: 0,
            ticket_type_name_en: 'Free',
            ticket_type_name_ja: '無料',
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
        },
        {
            multi: true
        }
    ).exec();
}
