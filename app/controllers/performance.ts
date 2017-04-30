/**
 * パフォーマンスタスクコントローラー
 *
 * @namespace controller/performance
 */

import { Models, PerformanceStatusesModel } from '@motionpicture/chevre-domain';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';

const DEFAULT_RADIX = 10;
const debug = createDebug('chevre-jobs:controller:performance');

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

        // TODO anyで逃げているが、型定義をちゃんとかけばもっとよく書ける
        const status = (<any>performance).getSeatStatus(reservationNumbers[performance.get('_id').toString()]);
        performanceStatusesModel.setStatus(performance._id.toString(), status);
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
