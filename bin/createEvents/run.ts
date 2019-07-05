/**
 * Chevreにイベントを作成する
 */
import * as chevreapi from '@chevre/api-nodejs-client';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';
import * as moment from 'moment-timezone';

const debug = createDebug('ttts-jobs:createEvents');
const USE_CHEVRE = process.env.USE_CHEVRE === '1';

const project = { typeOf: <'Project'>'Project', id: <string>process.env.PROJECT_ID };

/**
 * 設定からイベントを作成する
 */
// tslint:disable-next-line:max-func-body-length
export async function main(): Promise<void> {
    if (!USE_CHEVRE) {
        return;
    }

    // 作成情報取得
    const setting: any = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/setting.json`);
    debug('setting:', setting);

    // 引数情報取得
    const targetInfo = getTargetInfoForCreateFromSetting(setting.performance_duration, setting.no_performance_times);
    debug('targetInfo:', targetInfo);

    const authClient = new chevreapi.auth.ClientCredentials({
        domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
        clientId: <string>process.env.CHEVRE_CLIENT_ID,
        clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
        scopes: [],
        state: ''
    });

    const offerService = new chevreapi.service.Offer({
        endpoint: <string>process.env.CHEVRE_API_ENDPOINT,
        auth: authClient
    });
    const placeService = new chevreapi.service.Place({
        endpoint: <string>process.env.CHEVRE_API_ENDPOINT,
        auth: authClient
    });
    const eventService = new chevreapi.service.Event({
        endpoint: <string>process.env.CHEVRE_API_ENDPOINT,
        auth: authClient
    });

    // tslint:disable-next-line:max-func-body-length
    await Promise.all(targetInfo.map(async (performanceInfo) => {
        // 2017/10 2次 予約枠、時間の変更対応
        const screen = (setting.special_screens[performanceInfo.start_time] !== undefined)
            ? setting.special_screens[performanceInfo.start_time]
            : setting.screen;

        const id = [
            // tslint:disable-next-line:no-magic-numbers
            performanceInfo.day.slice(-6),
            setting.film,
            screen,
            performanceInfo.start_time
        ].join('');

        // 劇場検索
        const searchMovieTheatersResult = await placeService.searchMovieTheaters({
            project: { ids: [project.id] }
        });
        const movieTheaterWithoutScreeningRoom = searchMovieTheatersResult.data.find((d) => d.branchCode === '001');
        if (movieTheaterWithoutScreeningRoom === undefined) {
            throw new Error('Movie Theater Not Found');
        }
        const movieTheater = await placeService.findMovieTheaterById({ id: movieTheaterWithoutScreeningRoom.id });
        debug('movieTheater:', movieTheater);

        const screeningRoom = movieTheater.containsPlace[0];

        // 劇場作品検索
        const searchScreeningEventSeriesResult = await eventService.search<chevreapi.factory.eventType.ScreeningEventSeries>({
            project: { ids: [project.id] },
            typeOf: chevreapi.factory.eventType.ScreeningEventSeries,
            workPerformed: { identifiers: ['001'] }
        });
        const screeningEventSeries = searchScreeningEventSeriesResult.data[0];
        debug('screeningEventSeries:', screeningEventSeries);

        // 券種検索
        const searchTicketTypeGroupsResult = await offerService.searchTicketTypeGroups({
            project: { ids: [project.id] },
            identifier: '^01$'
        });
        const ticketTypeGroup = searchTicketTypeGroupsResult.data[0];
        debug('ticketTypeGroup:', ticketTypeGroup);

        const searchTicketTypesResult = await offerService.searchTicketTypes({
            project: { ids: [project.id] },
            ids: ticketTypeGroup.ticketTypes
        });
        const ticketTypes = searchTicketTypesResult.data;
        debug('ticketTypes:', ticketTypes);

        const offers = {
            id: ticketTypeGroup.id,
            name: ticketTypeGroup.name,
            typeOf: <'Offer'>'Offer',
            priceCurrency: chevreapi.factory.priceCurrency.JPY,
            availabilityEnds: moment(performanceInfo.end_date).tz('Asia/Tokyo').endOf('date').toDate(),
            // tslint:disable-next-line:no-magic-numbers
            availabilityStarts: moment(performanceInfo.start_date).tz('Asia/Tokyo').startOf('date').add(-3, 'months').toDate(),
            eligibleQuantity: {
                typeOf: <'QuantitativeValue'>'QuantitativeValue',
                unitCode: <chevreapi.factory.unitCode.C62>chevreapi.factory.unitCode.C62,
                maxValue: 10,
                value: 1
            },
            itemOffered: {
                serviceType: <any>{},
                serviceOutput: {
                    typeOf: chevreapi.factory.reservationType.EventReservation,
                    reservedTicket: {
                        typeOf: <'Ticket'>'Ticket',
                        ticketedSeat: { typeOf: <chevreapi.factory.placeType.Seat>chevreapi.factory.placeType.Seat }
                    }
                }
            },
            validThrough: moment(performanceInfo.end_date).tz('Asia/Tokyo').endOf('date').toDate(),
            // tslint:disable-next-line:no-magic-numbers
            validFrom: moment(performanceInfo.start_date).tz('Asia/Tokyo').startOf('date').add(-3, 'months').toDate(),
            acceptedPaymentMethod: [
                chevreapi.factory.paymentMethodType.Cash,
                chevreapi.factory.paymentMethodType.CreditCard,
                chevreapi.factory.paymentMethodType.Others
            ]
        };

        // パフォーマンス登録
        const event: chevreapi.factory.event.screeningEvent.IAttributes = {
            project: project,
            typeOf: chevreapi.factory.eventType.ScreeningEvent,
            eventStatus: chevreapi.factory.eventStatusType.EventScheduled,
            name: screeningEventSeries.name,
            doorTime: performanceInfo.door_time,
            startDate: performanceInfo.start_date,
            endDate: performanceInfo.end_date,
            workPerformed: screeningEventSeries.workPerformed,
            superEvent: screeningEventSeries,
            location: {
                project: project,
                typeOf: <chevreapi.factory.placeType.ScreeningRoom>screeningRoom.typeOf,
                branchCode: screeningRoom.branchCode,
                name: screeningRoom.name,
                alternateName: screeningRoom.alternateName,
                address: screeningRoom.address
            },
            offers: offers,
            checkInCount: undefined,
            attendeeCount: undefined,
            additionalProperty: [{ name: 'tourNumber', value: String(performanceInfo.tour_number) }]
        };

        debug('upserting event...', id);
        await eventService.update({
            id: id,
            attributes: event,
            upsert: true
        });
    }));
}

export interface ITargetPerformanceInfo {
    day: string;
    start_time: string;
    end_time: string;
    door_time: Date;
    start_date: Date;
    end_date: Date;
    duration: string;
    tour_number: string;
}

/**
 * パフォーマンス作成・作成対象情報取得
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

        hours.forEach((hourStr) => {
            // 2桁でない時は'0'詰め
            // tslint:disable-next-line:no-magic-numbers
            const hour = `0${hourStr}`.slice(-2);

            minutes.forEach((minute, minuteIndex) => {
                // ツアー情報作成
                const tourNumber = `${hour}${tours[minuteIndex]}`;
                const startDate = moment(`${now.format('YYYYMMDD')} ${hour}:${minute}:00+09:00`, 'YYYYMMDD HH:mm:ssZ');
                const endDate = moment(startDate).add(duration, 'minutes');
                const day = moment(startDate).tz('Asia/Tokyo').format('YYYYMMDD');
                const startTime = moment(startDate).tz('Asia/Tokyo').format('HHmm');
                const endTime = moment(endDate).tz('Asia/Tokyo').format('HHmm');

                // パフォーマンスを作成しない時刻に指定されていなかったら作成
                if (noPerformanceTimes.indexOf(`${hour}${minute}`) < 0) {
                    performanceInfos.push({
                        day: day,
                        start_time: startTime,
                        end_time: endTime,
                        door_time: startDate.toDate(),
                        start_date: startDate.toDate(),
                        end_date: endDate.toDate(),
                        tour_number: tourNumber,
                        duration: moment.duration(duration, 'minutes').toISOString()
                    });
                }
            });
        });
    }

    return performanceInfos;
}

// tslint:disable-next-line:no-floating-promises
main()
    .catch((err) => {
        // tslint:disable-next-line:no-console
        console.error(err);
    }).then(() => {
        // tslint:disable-next-line:no-console
        console.log('success!');
    });
