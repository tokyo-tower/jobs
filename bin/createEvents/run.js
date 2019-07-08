"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Chevreにイベントを作成する
 */
const chevreapi = require("@chevre/api-nodejs-client");
const createDebug = require("debug");
const fs = require("fs-extra");
const moment = require("moment-timezone");
const debug = createDebug('ttts-jobs:createEvents');
const USE_CHEVRE = process.env.USE_CHEVRE === '1';
const project = { typeOf: 'Project', id: process.env.PROJECT_ID };
/**
 * 設定からイベントを作成する
 */
// tslint:disable-next-line:max-func-body-length
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!USE_CHEVRE) {
            return;
        }
        // 作成情報取得
        const setting = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/setting.json`);
        debug('setting:', setting);
        // 引数情報取得
        const targetInfo = getTargetInfoForCreateFromSetting(setting.performance_duration, setting.no_performance_times);
        debug('targetInfo:', targetInfo);
        const authClient = new chevreapi.auth.ClientCredentials({
            domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
            clientId: process.env.CHEVRE_CLIENT_ID,
            clientSecret: process.env.CHEVRE_CLIENT_SECRET,
            scopes: [],
            state: ''
        });
        const offerService = new chevreapi.service.Offer({
            endpoint: process.env.CHEVRE_API_ENDPOINT,
            auth: authClient
        });
        const placeService = new chevreapi.service.Place({
            endpoint: process.env.CHEVRE_API_ENDPOINT,
            auth: authClient
        });
        const eventService = new chevreapi.service.Event({
            endpoint: process.env.CHEVRE_API_ENDPOINT,
            auth: authClient
        });
        // 劇場検索
        const searchMovieTheatersResult = yield placeService.searchMovieTheaters({
            project: { ids: [project.id] }
        });
        const movieTheaterWithoutScreeningRoom = searchMovieTheatersResult.data.find((d) => d.branchCode === setting.theater);
        if (movieTheaterWithoutScreeningRoom === undefined) {
            throw new Error('Movie Theater Not Found');
        }
        const movieTheater = yield placeService.findMovieTheaterById({ id: movieTheaterWithoutScreeningRoom.id });
        debug('movieTheater:', movieTheater);
        const screeningRoom = movieTheater.containsPlace[0];
        // 劇場作品検索
        const workPerformedIdentifier = setting.film;
        const searchScreeningEventSeriesResult = yield eventService.search({
            project: { ids: [project.id] },
            typeOf: chevreapi.factory.eventType.ScreeningEventSeries,
            workPerformed: { identifiers: [workPerformedIdentifier] }
        });
        const screeningEventSeries = searchScreeningEventSeriesResult.data[0];
        debug('screeningEventSeries:', screeningEventSeries);
        // 券種検索
        const ticketTypeGroupIdentifier = setting.ticket_type_group;
        const searchTicketTypeGroupsResult = yield offerService.searchTicketTypeGroups({
            project: { ids: [project.id] },
            identifier: `^${ticketTypeGroupIdentifier}$`
        });
        const ticketTypeGroup = searchTicketTypeGroupsResult.data[0];
        debug('ticketTypeGroup:', ticketTypeGroup);
        const searchTicketTypesResult = yield offerService.searchTicketTypes({
            project: { ids: [project.id] },
            ids: ticketTypeGroup.ticketTypes
        });
        const ticketTypes = searchTicketTypesResult.data;
        debug('ticketTypes:', ticketTypes);
        for (const performanceInfo of targetInfo) {
            const id = [
                // tslint:disable-next-line:no-magic-numbers
                performanceInfo.day.slice(-6),
                workPerformedIdentifier,
                movieTheater.branchCode,
                screeningRoom.branchCode,
                performanceInfo.start_time
            ].join('');
            const offers = {
                id: ticketTypeGroup.id,
                name: ticketTypeGroup.name,
                typeOf: 'Offer',
                priceCurrency: chevreapi.factory.priceCurrency.JPY,
                availabilityEnds: moment(performanceInfo.end_date).tz('Asia/Tokyo').endOf('date').toDate(),
                // tslint:disable-next-line:no-magic-numbers
                availabilityStarts: moment(performanceInfo.start_date).tz('Asia/Tokyo').startOf('date').add(-3, 'months').toDate(),
                eligibleQuantity: {
                    typeOf: 'QuantitativeValue',
                    unitCode: chevreapi.factory.unitCode.C62,
                    maxValue: 10,
                    value: 1
                },
                itemOffered: {
                    serviceType: {},
                    serviceOutput: {
                        typeOf: chevreapi.factory.reservationType.EventReservation,
                        reservedTicket: {
                            typeOf: 'Ticket',
                            ticketedSeat: { typeOf: chevreapi.factory.placeType.Seat }
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
            const event = {
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
                    typeOf: screeningRoom.typeOf,
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
            yield eventService.update({
                id: id,
                attributes: event,
                upsert: true
            });
            debug('upserted', id);
        }
    });
}
exports.main = main;
/**
 * パフォーマンス作成・作成対象情報取得
 */
function getTargetInfoForCreateFromSetting(duration, noPerformanceTimes) {
    const performanceInfos = [];
    // 引数から作成対象時間と作成日数を取得
    const argvLength = 5;
    if (process.argv.length < argvLength) {
        throw new Error('argv \'time\' or \'days\' not found.');
    }
    const indexTargetHours = 2;
    const indexStartDay = 3;
    const indexTargetDays = 4;
    // 作成対象時間: 9,10,11など
    const hours = process.argv[indexTargetHours].split(',');
    // 作成開始が今日から何日後か: 30
    const start = Number(process.argv[indexStartDay]);
    // 何日分作成するか: 7
    const days = Number(process.argv[indexTargetDays]);
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
