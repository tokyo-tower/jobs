/**
 * パフォーマンスタスクコントローラー
 *
 * @namespace PerformanceController
 */

import { Models, PerformanceStatusesModel } from '@motionpicture/chevre-domain';

import * as fs from 'fs-extra';
import * as log4js from 'log4js';
import * as mongoose from 'mongoose';

const MONGOLAB_URI = process.env.MONGOLAB_URI;
const DEFAULT_RADIX = 10;

// todo ログ出力方法考える
log4js.configure({
    appenders: [
        {
            category: 'system',
            type: 'console'
        }
    ],
    levels: {
        system: 'ALL'
    },
    replaceConsole: true
});
const logger = log4js.getLogger('system');

/**
 *
 *
 * @memberOf PerformanceController
 */
export function createFromJson(): void {
    mongoose.connect(MONGOLAB_URI, {});

    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/performances.json`, 'utf8', async (readFileErr, data) => {
        if (readFileErr instanceof Error) throw readFileErr;
        const performances: any[] = JSON.parse(data);

        const screens = await Models.Screen.find({}, 'name theater').populate('theater', 'name').exec();

        // あれば更新、なければ追加
        const promises = performances.map(async (performance) => {
            // 劇場とスクリーン名称を追加
            const screenOfPerformance = screens.find((screen) => {
                return (screen.get('_id').toString() === performance.screen);
            });
            if (screenOfPerformance === undefined) throw new Error('screen not found.');

            performance.screen_name = screenOfPerformance.get('name');
            performance.theater_name = screenOfPerformance.get('theater').get('name');

            logger.debug('updating performance...');
            await Models.Performance.findOneAndUpdate(
                { _id: performance._id },
                performance,
                {
                    new: true,
                    upsert: true
                }
            ).exec();
            logger.debug('performance updated');
        });

        await Promise.all(promises);
        logger.info('promised.');
        mongoose.disconnect();
        process.exit(0);
    });
}

/**
 * 空席ステータスを更新する
 *
 * @memberOf PerformanceController
 */
export async function updateStatuses() {
    mongoose.connect(MONGOLAB_URI, {});

    logger.info('finding performances...');
    const performances = await Models.Performance.find(
        {},
        'day start_time screen'
    )
        .populate('screen', 'seats_number')
        .exec();

    logger.info('performances found.');

    const performanceStatusesModel = PerformanceStatusesModel.create();

    logger.info('aggregating...');
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

    logger.info('saving performanceStatusesModel...', performanceStatusesModel);
    PerformanceStatusesModel.store(performanceStatusesModel, (storeErr) => {
        logger.info('performanceStatusesModel saved.', storeErr);
        mongoose.disconnect();
        process.exit(0);
    });
}

/**
 * ID指定でパフォーマンスを公開する
 *
 * @memberOf PerformanceController
 */
export function release(performanceId: string): void {
    mongoose.connect(MONGOLAB_URI, {});

    logger.info('updating performance..._id:', performanceId);
    Models.Performance.findOneAndUpdate(
        {
            _id: performanceId
        },
        {
            canceled: false
        },
        {
            new: true
        },
        (err, performance) => {
            logger.info('performance updated', err, performance);
            mongoose.disconnect();
            process.exit(0);
        }
    );
}
