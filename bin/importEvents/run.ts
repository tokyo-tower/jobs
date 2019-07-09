/**
 * Chevreからイベントをインポート
 */
import * as chevreapi from '@chevre/api-nodejs-client';
import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';
import * as moment from 'moment-timezone';

import mongooseConnectionOptions from '../../mongooseConnectionOptions';

const debug = createDebug('ttts-jobs:createEvents');
const USE_CHEVRE = process.env.USE_CHEVRE === '1';

const project = { typeOf: <'Project'>'Project', id: <string>process.env.PROJECT_ID };

// tslint:disable-next-line:max-func-body-length
export async function main(): Promise<void> {
    await ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

    if (!USE_CHEVRE) {
        return;
    }

    // 作成情報取得
    const setting: any = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/setting.json`);
    debug('setting:', setting);

    // 引数情報取得
    const { importFrom, importThrough } = getImportPeriod();
    debug(importFrom, importThrough);

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

    // 劇場検索
    const searchMovieTheatersResult = await placeService.searchMovieTheaters({
        project: { ids: [project.id] }
    });
    const movieTheaterWithoutScreeningRoom = searchMovieTheatersResult.data.find((d) => d.branchCode === setting.theater);
    if (movieTheaterWithoutScreeningRoom === undefined) {
        throw new Error('Movie Theater Not Found');
    }
    const movieTheater = await placeService.findMovieTheaterById({ id: movieTheaterWithoutScreeningRoom.id });
    debug('movieTheater:', movieTheater);

    const screeningRoom = movieTheater.containsPlace[0];

    // 劇場作品検索
    const workPerformedIdentifier = setting.film;
    const searchScreeningEventSeriesResult = await eventService.search<chevreapi.factory.eventType.ScreeningEventSeries>({
        project: { ids: [project.id] },
        typeOf: chevreapi.factory.eventType.ScreeningEventSeries,
        workPerformed: { identifiers: [workPerformedIdentifier] }
    });
    const screeningEventSeries = searchScreeningEventSeriesResult.data[0];
    debug('screeningEventSeries:', screeningEventSeries);

    // 券種検索
    const ticketTypeGroupIdentifier = setting.ticket_type_group;
    const searchTicketTypeGroupsResult = await offerService.searchTicketTypeGroups({
        project: { ids: [project.id] },
        identifier: `^${ticketTypeGroupIdentifier}$`
    });
    const ticketTypeGroup = searchTicketTypeGroupsResult.data[0];
    debug('ticketTypeGroup:', ticketTypeGroup);

    const searchTicketTypesResult = await offerService.searchTicketTypes({
        project: { ids: [project.id] },
        ids: ticketTypeGroup.ticketTypes
    });
    const ticketTypes = searchTicketTypesResult.data;
    debug('ticketTypes:', ticketTypes);

    // 上映スケジュール取得
    const limit = 100;
    let page = 0;
    let numData: number = limit;
    const events: chevreapi.factory.event.IEvent<chevreapi.factory.eventType.ScreeningEvent>[] = [];
    while (numData === limit) {
        page += 1;
        const searchScreeningEventsResult = await eventService.search<chevreapi.factory.eventType.ScreeningEvent>({
            limit: limit,
            page: page,
            project: { ids: [project.id] },
            typeOf: chevreapi.factory.eventType.ScreeningEvent,
            inSessionFrom: importFrom,
            inSessionThrough: importThrough
        });
        numData = searchScreeningEventsResult.data.length;
        debug('numData:', numData);
        events.push(...searchScreeningEventsResult.data);
    }

    const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);
    const taskRepo = new ttts.repository.Task(ttts.mongoose.connection);

    // イベントごとに永続化トライ
    for (const e of events) {
        try {
            let tourNumber = '';
            if (Array.isArray(e.additionalProperty)) {
                const tourNumberProperty = e.additionalProperty.find((p) => p.name === 'tourNumber');
                if (tourNumberProperty !== undefined) {
                    tourNumber = tourNumberProperty.value;
                }
            }

            const offers = e.offers;
            if (offers !== undefined) {
                // パフォーマンス登録
                const performance: ttts.factory.performance.IPerformance = {
                    id: e.id,
                    doorTime: moment(e.doorTime).toDate(),
                    startDate: moment(e.startDate).toDate(),
                    endDate: moment(e.endDate).toDate(),
                    duration: <string>e.superEvent.duration,
                    superEvent: e.superEvent,
                    location: <any>{
                        id: <string>screeningRoom.id,
                        branchCode: screeningRoom.branchCode,
                        name: screeningRoom.name,
                        // sections: screeningRoom.containsPlace.map((p) => {
                        //     return {
                        //         code: <string>p.branchCode,
                        //         branchCode: <string>p.branchCode,
                        //         seats: (Array.isArray(p.containsPlace))
                        //             ? p.containsPlace.map((seat) => {
                        //                 return {
                        //                     code: <string>seat.branchCode,
                        //                     branchCode: <string>seat.branchCode,
                        //                     seatingType: (<any>seat).seatingType
                        //                 };
                        //             })
                        //             : []
                        //     };
                        // }),
                        seats_number: 42
                    },
                    additionalProperty: e.additionalProperty,
                    ttts_extension: {
                        tour_number: tourNumber,
                        ev_service_status: ttts.factory.performance.EvServiceStatus.Normal,
                        ev_service_update_user: '',
                        online_sales_status: ttts.factory.performance.OnlineSalesStatus.Normal,
                        online_sales_update_user: '',
                        refund_status: ttts.factory.performance.RefundStatus.None,
                        refund_update_user: '',
                        refunded_count: 0
                    },
                    ticket_type_group: <any>{
                        id: offers.id,
                        ticket_types: ticketTypes.map((t) => {
                            return {
                                ...t,
                                id: t.identifier // 互換性維持のためIDを識別子に置き換える
                            };
                        }),
                        name: offers.name
                    }
                };

                debug('creating performance...', performance);
                await performanceRepo.saveIfNotExists(performance);
                debug('saved', performance.id);

                // 集計タスク作成
                const aggregateTask: ttts.factory.task.aggregateEventReservations.IAttributes = {
                    name: ttts.factory.taskName.AggregateEventReservations,
                    status: ttts.factory.taskStatus.Ready,
                    runsAt: new Date(),
                    remainingNumberOfTries: 3,
                    // tslint:disable-next-line:no-null-keyword
                    lastTriedAt: null,
                    numberOfTried: 0,
                    executionResults: [],
                    data: { id: performance.id }
                };
                await taskRepo.save(aggregateTask);
            }
        } catch (error) {
            // tslint:disable-next-line:no-single-line-block-comment
            /* istanbul ignore next */
            // tslint:disable-next-line:no-console
            console.error(error);
        }
    }
}

function getImportPeriod() {
    // 引数から作成対象時間と作成日数を取得
    const argvLength: number = 4;
    if (process.argv.length < argvLength) {
        throw new Error('argv \'time\' or \'days\' not found.');
    }

    const indexStartDay: number = 2;
    const indexTargetDays: number = 3;
    // 作成開始が今日から何日後か: 30
    const start: number = Number(process.argv[indexStartDay]);
    // 何日分作成するか: 7
    const days: number = Number(process.argv[indexTargetDays]);

    const importFrom = moment().add(start, 'days').tz('Asia/Tokyo').startOf('date').toDate();
    const importThrough = moment(importFrom).add(days - 1, 'days').tz('Asia/Tokyo').endOf('date').toDate();

    return { importFrom, importThrough };
}

// tslint:disable-next-line:no-floating-promises
main()
    .catch((err) => {
        // tslint:disable-next-line:no-console
        console.error(err);
    }).then(async () => {
        await ttts.mongoose.disconnect();
        // tslint:disable-next-line:no-console
        console.log('success!');
    });
