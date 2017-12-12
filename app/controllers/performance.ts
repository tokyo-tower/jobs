/**
 * パフォーマンスタスクコントローラー
 * @namespace controller/performance
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';
import * as moment from 'moment';

const debug = createDebug('ttts-jobs:controller:performance');

/**
 * 設定からパフォーマンスデータを作成する
 * @memberof controller/performance
 */
export async function createFromSetting(): Promise<void> {
    // 作成情報取得
    const setting: any = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/setting.json`);

    // 引数情報取得
    const targetInfo = getTargetInfoForCreateFromSetting(setting.performance_duration);
    const times = targetInfo.times;
    const days = targetInfo.days;

    // 劇場とスクリーン情報取得
    const screenOfPerformance = await ttts.Models.Screen.findById(setting.screen, 'name theater sections')
        .populate('theater', 'name address')
        .exec();
    if (screenOfPerformance === undefined) {
        throw new Error('screen not found.');
    }

    // 作品情報取得
    const film = await ttts.Models.Film.findById({ _id: setting.film }).exec();
    if (film === undefined) {
        throw new Error('film not found.');
    }

    // パフォーマンス登録
    const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);
    const performance: any = {};
    const savePerformances: any = [];
    performance.screen_name = (screenOfPerformance !== null) ? screenOfPerformance.get('name') : '';
    performance.theater_name = (screenOfPerformance !== null) ? screenOfPerformance.get('theater').get('name') : '';
    performance.theater = setting.theater;
    //performance.screen = setting.screen;
    performance.film = setting.film;
    performance.canceled = false;
    performance.ticket_type_group = setting.ticket_type_group;

    // 7日分Loop
    const promisesDay = (days.map(async (day: string) => {
        performance.day = day;
        // 開始時間分Loop
        const promisesTime = (times.map(async (time: any) => {
            // パフォーマンス時間情報セット
            performance.open_time = time.open_time;
            performance.start_time = time.start_time;
            performance.end_time = time.end_time;
            performance.ttts_extension = {
                tour_number: time.tour_number,
                ev_service_status: ttts.PerformanceUtil.EV_SERVICE_STATUS.NORMAL,
                ev_service_update_user: '',
                online_sales_status: ttts.PerformanceUtil.ONLINE_SALES_STATUS.NORMAL,
                online_sales_update_user: '',
                refund_status: ttts.PerformanceUtil.REFUND_STATUS.NONE,
                refund_update_user: '',
                refunded_count: 0
            };
            // 2017/10 2次 予約枠、時間の変更対応
            performance.screen =
                setting.special_screens.hasOwnProperty(performance.start_time) ?
                    setting.special_screens[performance.start_time] : setting.screen;

            // パフォーマンス登録
            debug('creating performance...');
            //スクリーン、作品、上映日、開始時間
            const result = await performanceRepo.performanceModel.findOneAndUpdate(
                {
                    screen: performance.screen,
                    film: performance.film,
                    day: performance.day,
                    start_time: performance.start_time
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
        await Promise.all(promisesTime);
    }));
    await Promise.all(promisesDay);
}
/**
 * パフォーマンス作成・作成対象情報取得
 *
 * @memberof controller/performance
 */
function getTargetInfoForCreateFromSetting(duration: number): any {
    const info: any = {};
    info.days = [];
    info.times = [];

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
    const tours: string[] = ['1', '2', '3', '4'];
    const hourLength: number = 2;
    // 終了時刻取得
    const getEndTime = (startTime: string) => {
        const startMoment: moment.Moment = moment(startTime, 'HHmm');

        return moment(startMoment.add(duration, 'minutes'), 'HHmm').format('HHmm');
    };
    hours.forEach((hour) => {
        // 2桁でない時は'0'詰め
        hour = (hour.length < hourLength) ? `0${hour}` : hour;
        let index: number = 0;
        minutes.forEach((minute) => {
            const startTime: string = hour + minute;
            info.times.push({
                open_time: startTime,
                start_time: startTime,
                end_time: getEndTime(startTime),
                tour_number: `${hour}${tours[index]}`
            });
            index += 1;
        });
    });

    return info;
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
