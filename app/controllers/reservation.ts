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
    const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);
    const performances = await performanceRepo.performanceModel.find(
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
