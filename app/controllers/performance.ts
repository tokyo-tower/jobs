/**
 * パフォーマンスタスクコントローラー
 *
 * @namespace controller/performance
 */

import { Models, PerformanceStatusesModel } from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';

const STATUS_AVAILABLE: string = 'AVAILABLE';
const DEFAULT_RADIX = 10;
const debug = createDebug('ttts-jobs:controller:performance');
/**
 *
 *
 * @memberOf controller/performance
 */
// tslint:disable-next-line:max-func-body-length
export async function createFromSetting(): Promise<void> {
    //const setting: any = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/setting.json`);
    const setting: any = {
        film : '000999',
        day : '20180101',
        theater : '001',
        screen : '00901',
        ticket_type_group : '01'
    };
    // 劇場とスクリーン情報取得
    const screenOfPerformance = await Models.Screen.findById(setting.screen, 'name theater sections')
                                       .populate('theater', 'name address')
                                       .exec();
    if (screenOfPerformance === undefined) {
        throw new Error('screen not found.');
    }
    // 作品情報取得
    const film = await Models.Film.findById({ _id: setting.film}).exec();
    if (film === undefined) {
        throw new Error('film not found.');
    }

    // 展開する時間をセット
    const hours: string[] = ['09', '10', '11', '12', '13', '14'];
    const minutes: string[] = ['00', '15', '30', '45'];
    const duration: number = 14;
    const times: any[] = [];
    hours.forEach( (hour) => {
        minutes.forEach( (minute) => {
            times.push({
                open_time: hour + minute,
                start_time: hour + minute,
                end_time: hour + (Number(minute) + duration).toString()
            });
        });
    });
    // パフォーマンス登録
    const performance: any = {};
    const savePerformances: any = [];
    performance.screen_name = screenOfPerformance.get('name');
    performance.theater_name = screenOfPerformance.get('theater').get('name');
    performance.theater = setting.theater;
    performance.screen = setting.screen;
    performance.film = setting.film;
    performance.day = setting.day;
    performance.canceled = false;
    performance.ticket_type_group = setting.ticket_type_group;
    const promises = (times.map(async (time) => {
        // パフォーマンス時間情報セット
        performance.open_time = time.open_time;
        performance.start_time = time.start_time;
        performance.end_time = time.end_time;
        // パフォーマンス登録
        debug('creating performance...');
        //const result = await Models.Performance.create(performance);
        //スクリーン、作品、上映日、開始時間
        const result = await Models.Performance.findOneAndUpdate(
            {
                screen : performance.screen,
                film : performance.film,
                day : performance.day,
                start_time : performance.start_time
            },
            {
                // 初回は $setと$setOnInsertがセットされ2回目以降は$setのみセット
                // created_atは更新されない
                $set: performance
                //$setOnInsert: performance
            },
            {
                upsert: true,
                new: true
            }
        ).exec();
        debug('performance created');
        if (result !== null) {
            performance._id = (<any>result)._id;
            savePerformances.push(result);
        }
    }));
    await Promise.all(promises);

    // 予約登録
    const promisesR = ((<any>savePerformances).map(async (savePerformance: any) => {
        const promisesS = ((<any>screenOfPerformance).get('sections')[0].seats.map(async (seat: any) => {
            const reservation: any = {};
            reservation.performance = savePerformance._id;
            reservation.seat_code = seat.code;
            reservation.status = STATUS_AVAILABLE;
            reservation.performance_canceled = false;
            reservation.checkins = [];
            // 2017/05/23 chevreの"TEMPORARY"データに項目を合わせるため削除
            // reservation.performance_day = savePerformance.day;
            // reservation.performance_open_time = savePerformance.open_time;
            // reservation.performance_start_time = savePerformance.start_time;
            // reservation.performance_end_time = savePerformance.end_time;
            // reservation.theater = savePerformance.theater;
            // reservation.theater_name = savePerformance.theater_name;
            // reservation.theater_address = screenOfPerformance.get('theater').get('address');
            // reservation.screen = savePerformance.screen;
            // reservation.screen_name = savePerformance.screen_name;
            // reservation.film = savePerformance.film;
            // reservation.film_name = (<any>film).name;
            //---
            const result = await Models.Reservation.findOneAndUpdate(
                {
                    performance: reservation.performance,
                    seat_code: reservation.seat_code
                },
                {
                    //なければ作成あれば更新：値は先勝ちで作成
                    //間違って同じ日の予約を流した時、すでに予約に進んでいるデータを壊さないため。
                    //$set: reservation
                    // 新規作成時のみセットしたいカラムは$setOnInsertに設定
                    // 項目が重なっていると、
                    // MongoError: Cannot update 'film' and 'film' at the same time
                    $setOnInsert: reservation
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
        await Promise.all(promisesS);
    }));
    await Promise.all(promisesR);
    debug('promised.');
}
/**
 *
 *
 * @memberOf controller/performance
 */
export async function createFromJson(): Promise<void> {
    const performances: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/performances.json`);
    const screens = await Models.Screen.find({}, 'name theater').populate('theater', 'name').exec();

    // あれば更新、なければ追加
    await Promise.all(performances.map(async (performance) => {
        // 劇場とスクリーン名称を追加
        const screenOfPerformance = screens.find((screen) => {
            return (screen.get('_id').toString() === performance.screen);
        });
        if (screenOfPerformance === undefined) {
            throw new Error('screen not found.');
        }

        performance.screen_name = screenOfPerformance.get('name');
        performance.theater_name = screenOfPerformance.get('theater').get('name');

        debug('creating performance...');
        await Models.Performance.create(performance);
        debug('performance created');
    }));
    debug('promised.');
}

/**
 * 空席ステータスを更新する
 *
 * @memberOf controller/performance
 */
export async function updateStatuses() {
    debug('finding performances...');
    const performances = await Models.Performance.find(
        {},
        'day start_time screen'
    ).populate('screen', 'seats_number').exec();
    debug('performances found.');

    const performanceStatusesModel = PerformanceStatusesModel.create();

    debug('aggregating...');
    const results: any[] = await Models.Reservation.aggregate(
        [
            {
                $match: {
                    status: STATUS_AVAILABLE
                }
            },
            {
                $group: {
                    _id: '$performance',
                    count: { $sum: 1 }
                }
            }
        ]
    ).exec();

    // パフォーマンスIDごとに
    const reservationNumbers: {
        [key: string]: number
    } = {};
    results.forEach((result) => {
        reservationNumbers[result._id] = parseInt(result.count, DEFAULT_RADIX);
    });

    performances.forEach((performance) => {
        // パフォーマンスごとに空席ステータスを算出する
        if (!reservationNumbers.hasOwnProperty(performance.get('_id').toString())) {
            reservationNumbers[performance.get('_id').toString()] = 0;
        }

        // 空席ステータス変更(空席数("予約可能"な予約データ数)をそのままセット)
        // TODO anyで逃げているが、型定義をちゃんとかけばもっとよく書ける
        //const status = (<any>performance).getSeatStatus(reservationNumbers[performance.get('_id').toString()]);
        //performanceStatusesModel.setStatus(performance._id.toString(), status);
        const reservationNumber: number = reservationNumbers[performance.get('_id')];
        //const availableSeatNum = (<any>performance).screen.seats_number - reservationNumber;
        //performanceStatusesModel.setStatus(performance._id.toString(), availableSeatNum.toString());
        performanceStatusesModel.setStatus(performance._id.toString(), reservationNumber.toString());
        //---
    });

    debug('saving performanceStatusesModel...', performanceStatusesModel);
    await PerformanceStatusesModel.store(performanceStatusesModel);
    debug('performanceStatusesModel saved.');
}

/**
 * ID指定でパフォーマンスを公開する
 *
 * @memberOf controller/performance
 */
export async function release(performanceId: string): Promise<void> {
    debug('updating performance..._id:', performanceId);
    await Models.Performance.findByIdAndUpdate(
        performanceId,
        { canceled: false }
    ).exec();
    debug('performance updated');
}
