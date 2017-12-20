/**
 * パフォーマンスタスクコントローラー
 * @namespace controller/performance
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';
import * as moment from 'moment';
// tslint:disable-next-line:no-require-imports no-var-requires
require('moment-timezone');

const debug = createDebug('ttts-jobs:controller:performance');

/**
 * 設定からパフォーマンスデータを作成する
 * @memberof controller/performance
 */
export async function createFromSetting(): Promise<void> {
    // 作成情報取得
    const setting: any = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/setting.json`);
    debug('setting:', setting);

    // 引数情報取得
    const targetInfo = getTargetInfoForCreateFromSetting(setting.performance_duration, setting.no_performance_times);
    debug('targetInfo:', targetInfo);

    // 劇場とスクリーン情報取得
    const screenOfPerformance = await ttts.Models.Screen.findById(setting.screen).populate('theater').exec();
    debug('screenOfPerformance:', screenOfPerformance);
    if (screenOfPerformance === null) {
        throw new Error('screen not found.');
    }

    // 作品情報取得
    const film = await ttts.Models.Film.findById({ _id: setting.film }).exec();
    debug('film:', film);
    if (film === null) {
        throw new Error('film not found.');
    }

    // パフォーマンス登録
    const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);
    const savePerformances: ttts.factory.performance.IPerformance[] = [];

    // 7日分Loop
    await Promise.all(targetInfo.map(async (performanceInfo) => {
        const day = moment(performanceInfo.start_date).tz('Asia/Tokyo').format('YYYYMMDD');
        const startTime = moment(performanceInfo.start_date).tz('Asia/Tokyo').format('HHmm');
        const endTime = moment(performanceInfo.end_date).tz('Asia/Tokyo').format('HHmm');
        // 2017/10 2次 予約枠、時間の変更対応
        const screen = (setting.special_screens[startTime] !== undefined) ? setting.special_screens[startTime] : setting.screen;

        // ユニークなIDを生成
        const id = [
            // tslint:disable-next-line:no-magic-numbers
            day.slice(-6),
            setting.film,
            screen,
            startTime
        ].join('');

        // パフォーマンス登録
        const performance: ttts.factory.performance.IPerformance = {
            id: id,
            theater: screenOfPerformance.get('theater').get('id'),
            theater_name: screenOfPerformance.get('theater').get('name'),
            screen: screen,
            screen_name: screenOfPerformance.get('name'),
            film: film.get('id'),
            ticket_type_group: setting.ticket_type_group,
            day: day,
            open_time: startTime,
            start_time: startTime,
            end_time: endTime,
            canceled: false,
            ttts_extension: {
                tour_number: performanceInfo.tour.code,
                ev_service_status: ttts.factory.performance.EvServiceStatus.Normal,
                ev_service_update_user: '',
                online_sales_status: ttts.factory.performance.OnlineSalesStatus.Normal,
                online_sales_update_user: '',
                refund_status: ttts.factory.performance.RefundStatus.None,
                refund_update_user: '',
                refunded_count: 0
            },
            door_time: performanceInfo.door_time,
            start_date: performanceInfo.start_date,
            end_date: performanceInfo.end_date,
            duration: performanceInfo.duration,
            tour: performanceInfo.tour
        };

        debug('creating performance...', performance);
        await performanceRepo.saveIfNotExists(performance);
        savePerformances.push(performance);
    }));
}

export interface ITargetPerformanceInfo {
    door_time: Date;
    start_date: Date;
    end_date: Date;
    duration: string;
    tour: ttts.factory.performance.ITour;
}

/**
 * パフォーマンス作成・作成対象情報取得
 * @memberof controller/performance
 */
function getTargetInfoForCreateFromSetting(duration: number, noPerformanceTimes: string[]): ITargetPerformanceInfo[] {
    const performanceInfos: ITargetPerformanceInfo[] = [];

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

    const minutes = ['00', '15', '30', '45'];
    const tours = ['1', '2', '3', '4'];

    // 本日日付+開始日までの日数から作成開始日セット
    // 作成日数分の作成対象日付作成
    for (let index = 0; index < days; index = index + 1) {
        const now = moment().add(start + index, 'days');

        hours.forEach((hour) => {
            // 2桁でない時は'0'詰め
            // tslint:disable-next-line:no-magic-numbers
            hour = `0${hour}`.slice(-2);
            const tourStartDate = moment(`${now.format('YYYYMMDD')} ${hour}:00:00+09:00`, 'YYYYMMDD HH:mm:ssZ');

            minutes.forEach((minute, minuteIndex) => {
                // ツアー情報作成
                const tourCode = `${hour}${tours[minuteIndex]}`;
                const tour: ttts.factory.performance.ITour = {
                    name: {
                        en: `Tour${tourCode}`,
                        ja: `ツアー${tourCode}`
                    },
                    code: `${tourCode}`,
                    door_time: tourStartDate.toDate(),
                    start_date: tourStartDate.toDate(),
                    end_date: moment(tourStartDate).add(1, 'hour').toDate(),
                    duration: moment.duration(1, 'hour').toISOString()
                };

                const startDate = moment(`${now.format('YYYYMMDD')} ${hour}:${minute}:00+09:00`, 'YYYYMMDD HH:mm:ssZ');

                // パフォーマンスを作成しない時刻に指定されていなかったら作成
                if (noPerformanceTimes.indexOf(`${hour}${minute}`) < 0) {
                    performanceInfos.push({
                        door_time: startDate.toDate(),
                        start_date: startDate.toDate(),
                        end_date: moment(startDate).add(duration, 'minutes').toDate(),
                        tour: tour,
                        duration: moment.duration(duration, 'minutes').toISOString()
                    });
                }
            });
        });
    }

    return performanceInfos;
}

/**
 *
 *
 * @memberof controller/performance
 */
export async function createFromJson(): Promise<void> {
    const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);

    const performances: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/performances.json`);
    const screens = await ttts.Models.Screen.find({}, 'name theater').populate('theater', 'name').exec();

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
        await performanceRepo.performanceModel.create(performance);
        debug('performance created');
    }));
    debug('promised.');
}

/**
 * ID指定でパフォーマンスを公開する
 *
 * @memberof controller/performance
 */
export async function release(performanceId: string): Promise<void> {
    const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);

    debug('updating performance..._id:', performanceId);
    await performanceRepo.performanceModel.findByIdAndUpdate(
        performanceId,
        { canceled: false }
    ).exec();
    debug('performance updated');
}
