/**
 * 座席予約タスクコントローラー
 * @namespace ReservationController
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';
import * as moment from 'moment';

const debug = createDebug('ttts-jobs:controller:reservation');

/**
 * 設定指定で座席在庫を作成する
 * @memberof controller/reservation
 */
export async function createFromSetting(): Promise<void> {
    // 引数情報取得
    const targetInfo = getTargetInfoForCreateFromSetting();
    const times = targetInfo.startTimes;
    const days = targetInfo.days;
    debug('times days', times, days);

    // 作成情報取得(作品、スクリーン、作成日(引数の日数より)、開始時刻(引数の時刻より))
    // 2017/10 検索条件からスクリーン削除
    // screen: setting.screen,
    const setting: any = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/setting.json`);
    debug('setting:', setting);
    const performances = await ttts.Models.Performance.find(
        {
            film: setting.film,
            day: { $in: days },
            start_time: { $in: times }
        },
        '_id start_time screen'
    ).exec();

    // 劇場とスクリーン情報取得
    // const screenOfPerformance = await Models.Screen.findById(setting.screen, 'name theater sections')
    //                                    .populate('theater', 'name address')
    //                                    .exec();
    // if (screenOfPerformance === undefined) {
    //     throw new Error('screen not found.');
    // }
    const screenOfPerformances = await ttts.Models.Screen.find({}, 'name theater sections')
        .populate('theater', 'name address')
        .exec();
    const screens: any = {};
    (<any>screenOfPerformances).map((screen: any) => {
        const id: string = screen._id;
        screens[id] = screen;
    });
    debug('screens:', screens);

    const stockRepo = new ttts.repository.Stock(ttts.mongoose.connection);

    // 予約登録・パフォーマンス分Loop
    const promisesR = ((<any>performances).map(async (performance: any) => {
        // 2017/10 2次 予約枠、時間の変更対応
        const screen: any = screens[performance.screen];
        // 座席分Loop
        //const promises = ((<any>screenOfPerformance).get('sections')[0].seats.map(async (seat: any) => {
        const promises = (screen.get('sections')[0].seats.map(async (seat: any) => {
            const stock: any = {
                performance: performance._id,
                seat_code: seat.code,
                availability: ttts.factory.itemAvailability.InStock
                // reservation.performance_canceled = false;
                // reservation.checkins = [];
            };
            debug('creating stock', stock);
            const result = await stockRepo.stockModel.findOneAndUpdate(
                {
                    performance: stock.performance,
                    seat_code: stock.seat_code
                },
                {
                    //なければ作成あれば更新：値は先勝ちで作成
                    //間違って同じ日の予約を流した時、すでに予約に進んでいるデータを壊さないため。
                    //$set: reservation
                    // 新規作成時のみセットしたいカラムは$setOnInsertに設定
                    // 項目が重なっているとエラーになる↓
                    // MongoError: Cannot update 'film' and 'film' at the same time
                    $setOnInsert: stock
                },
                {
                    upsert: true,
                    new: true
                }
            ).exec();
            if (result === null) {
                debug('error.');
            } else {
                debug('ok.');
            }
        }));
        await Promise.all(promises);
    }));
    await Promise.all(promisesR);
}
/**
 * パフォーマンス作成・作成対象情報取得
 * @memberof controller/performance
 */
function getTargetInfoForCreateFromSetting(): any {
    const info: any = {};
    info.days = [];
    info.startTimes = [];

    // 引数から作成対象時間と作成日数を取得
    const argvLength: number = 5;
    if (process.argv.length < argvLength) {
        throw new Error('argv \'time\' or \'days\' not found.');
    }
    const indexTargetHours: number = 2;
    const indexStartDay: number = 3;
    const indexTargetDays: number = 4;
    // 作成対象時間: 9,10,11など
    const hours: string[] = process.argv[indexTargetHours].split(',');
    // 作成開始が今日から何日後か: 30
    const start: number = Number(process.argv[indexStartDay]);
    // 何日分作成するか: 7
    const days: number = Number(process.argv[indexTargetDays]);

    // 本日日付+開始日までの日数から作成開始日セット
    const today = moment().add(start - 1, 'days');
    // 作成日数分の作成対象日付作成
    for (let index = 0; index < days; index = index + 1) {
        const dateWk: string = today.add(1, 'days').format('YYYYMMDD');
        info.days.push(dateWk);
    }
    const minutes: string[] = ['00', '15', '30', '45'];
    const hourLength: number = 2;
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
 * @memberof ReservationController
 */
export async function removeTmps(): Promise<void> {
    // const BUFFER_PERIOD_SECONDS = -60;
    // debug('removing temporary reservations...');
    // await ttts.Models.Reservation.remove(
    //     {
    //         status: ReservationUtil.STATUS_TEMPORARY,
    //         expired_at: {
    //             // 念のため、仮予約有効期間より1分長めにしておく
    //             $lt: moment().add(BUFFER_PERIOD_SECONDS, 'seconds').toISOString()
    //         }
    //     }
    // ).exec();
    // debug('temporary reservations removed.');

    // 失敗しても、次のタスクにまかせる(気にしない)
}

/**
 * 仮予約ステータスで、一定時間過ぎた予約を空席にする
 * (2017/05/23 削除→statusを"AVAILABLE"戻す、に変更)
 * removeTmpsは未使用になります。
 *
 * @memberOf ReservationController
 */
export async function resetTmps(): Promise<void> {
    // const BUFFER_PERIOD_SECONDS = -60;
    // debug('resetting temporary reservations...');
    // await ttts.Models.Reservation.update(
    //     {
    //         status: {
    //             $in: [ttts.ReservationUtil.STATUS_TEMPORARY,
    //             ttts.ReservationUtil.STATUS_TEMPORARY_FOR_SECURE_EXTRA]
    //         },
    //         expired_at: {
    //             // 念のため、仮予約有効期間より1分長めにしておく
    //             $lt: moment().add(BUFFER_PERIOD_SECONDS, 'seconds').toISOString()
    //         }
    //     },
    //     {
    //         $set: {
    //             status: STATUS_AVAILABLE
    //         },
    //         $unset: {
    //             payment_no: 1,
    //             ticket_type: 1,
    //             expired_at: 1,
    //             ticket_ttts_extension: 1,
    //             reservation_ttts_extension: 1
    //         }
    //     },
    //     {
    //         multi: true
    //     }
    // ).exec();
    // debug('temporary reservations reset.');
    // 失敗しても、次のタスクにまかせる(気にしない)
}

/**
 * TTTS確保上の仮予約をTTTS確保へ戻す
 * @memberof ReservationController
 */
export async function tmp2ttts(): Promise<void> {
    // const BUFFER_PERIOD_SECONDS = -60;
    // const ids = await ttts.Models.Reservation.distinct(
    //     '_id',
    //     {
    //         status: ttts.ReservationUtil.STATUS_TEMPORARY_ON_KEPT_BY_TTTS,
    //         expired_at: {
    //             // 念のため、仮予約有効期間より1分長めにしておく
    //             $lt: moment().add(BUFFER_PERIOD_SECONDS, 'seconds').toISOString()
    //         }
    //     }
    // ).exec();

    // await Promise.all(ids.map(async (id) => {
    //     await ttts.Models.Reservation.findByIdAndUpdate(
    //         id,
    //         { status: ttts.ReservationUtil.STATUS_KEPT_BY_TTTS }
    //     ).exec();
    // }));
}

/**
 * 固定日時を経過したら、空席ステータスにするバッチ
 * @memberof ReservationController
 */
export async function releaseSeatsKeptByMembers() {
    // if (moment(conf.get<string>('datetimes.reservation_end_members')) < moment()) {
    //     // 空席にする場合はこちら
    //     debug('releasing reservations kept by members...');
    //     await ttts.Models.Reservation.remove(
    //         {
    //             status: ttts.ReservationUtil.STATUS_KEPT_BY_MEMBER
    //         }
    //     ).exec();

    //     // 失敗しても、次のタスクにまかせる(気にしない)
    // }
}
