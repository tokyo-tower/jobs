/**
 * パフォーマンスタスクコントローラー
 *
 * @namespace controller/reservationPerHour
 */

import { Models, ReservationUtil, TicketTypeGroupUtil } from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import * as moment from 'moment';

const debug = createDebug('ttts-jobs:controller:performance');
/**
 *
 *
 * @memberOf controller/reservationPerHour
 */
export async function createFromSetting(): Promise<void> {
    // 引数情報取得
    const targetInfo = getTargetInfoForCreateFromSetting();
    const hours = targetInfo.hours;
    const days = targetInfo.days;

    const reservationPerHour: any = {
        ticket_category: TicketTypeGroupUtil.TICKET_TYPE_CATEGORY_WHEELCHAIR,
        status : ReservationUtil.STATUS_AVAILABLE
    };
    // 日数分Loop
    const promisesDay = (days.map(async (day : string) => {
        reservationPerHour.performance_day = day;
        // 時間分Loop
        const promisesHour = (hours.map(async (hour: string) => {
            // 時間帯セット
            reservationPerHour.performance_hour = hour;
            // 時間ごとの予約情報登録
            debug('creating reservationPerHour...');
            //スクリーン、作品、上映日、開始時間
            const result = await Models.ReservationPerHour.findOneAndUpdate(
                {
                    performance_day : reservationPerHour.performance_day,
                    performance_hour : reservationPerHour.performance_hour
                },
                {
                    $set: reservationPerHour
                },
                {
                    upsert: true,
                    new: true
                }
            ).exec();
            if (result !== null) {
                // tslint:disable-next-line:no-console
                console.log(result);
            }
            debug('reservationPerHour created');
        }));
        await Promise.all(promisesHour);
    }));
    await Promise.all(promisesDay);
}
/**
 * 時間ごとの予約情報作成・作成対象情報取得
 *
 * @memberOf controller/reservationPerHour
 */
function getTargetInfoForCreateFromSetting(): any {
    const info: any = {};
    info.days = [];
    info.hours = [];

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
    const hourLength: number = 2;
    hours.forEach( (hour) => {
        // 2桁でない時は'0'詰め
        hour = (hour.length < hourLength) ? `0${hour}` : hour;
        info.hours.push(hour);
    });

    return info;
}
/**
 * 仮予約ステータスで、一定時間過ぎた予約を空席にする
 * (statusを"AVAILABLE"戻す)
 *
 * @memberOf reservationPerHour
 */
export async function resetTmps(): Promise<void> {
    const BUFFER_PERIOD_SECONDS = -60;
    debug('resetting temporary reservationPerHour...');
    await Models.ReservationPerHour.update(
        {
            status: { $in: [ReservationUtil.STATUS_TEMPORARY,
                            ReservationUtil.STATUS_TEMPORARY_FOR_SECURE_EXTRA]
            },
            expired_at: {
                // 念のため、仮予約有効期間より1分長めにしておく
                $lt: moment().add(BUFFER_PERIOD_SECONDS, 'seconds').toISOString()
            }
        },
        {
            $set: {
                status: ReservationUtil.STATUS_AVAILABLE
            },
            $unset: {
                expired_at: 1,
                reservation_id: 1
            }
        },
        {
            multi: true
        }
    ).exec();
    debug('temporary reservationPerHour reset.');
    // 失敗しても、次のタスクにまかせる(気にしない)
}
