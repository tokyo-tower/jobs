/**
 * マスター同期コントローラー
 * @namespace controllers.masterSync
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';

const debug = createDebug('ttts-jobs:controllers:masterSync');

/**
 * jsonから作品生成
 */
export async function createFilmsFromJson(): Promise<void> {
    const films: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/films.json`);

    await Promise.all(films.map(async (film) => {
        debug('updating film...');
        await ttts.Models.Film.findByIdAndUpdate(
            film._id,
            film,
            {
                new: true,
                upsert: true
            }
        ).exec();
        debug('film updated');
    }));
    debug('promised.');
}

/**
 * jsonからスクリーン生成
 */
export async function createScreensFromJson(): Promise<void> {
    const screens: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/screens.json`);

    await Promise.all(screens.map(async (screen) => {
        // 座席数情報を追加
        screen.seats_number = screen.sections[0].seats.length;

        // 座席グレードごとの座席数情報を追加
        const seatsNumbersBySeatCode: {
            [key: string]: number
        } = {};
        seatsNumbersBySeatCode[ttts.factory.place.movieTheater.SeatGrade.Normal] = 0;
        seatsNumbersBySeatCode[ttts.factory.place.movieTheater.SeatGrade.PremiereBox] = 0;
        seatsNumbersBySeatCode[ttts.factory.place.movieTheater.SeatGrade.PremiereLuxury] = 0;
        seatsNumbersBySeatCode[ttts.factory.place.movieTheater.SeatGrade.FrontReclining] = 0;
        screen.sections[0].seats.forEach((seat: any) => {
            seatsNumbersBySeatCode[seat.grade.code] += 1;
        });
        screen.seats_numbers_by_seat_grade = Object.keys(seatsNumbersBySeatCode).map((seatGradeCode) => {
            return {
                seat_grade_code: seatGradeCode,
                seats_number: seatsNumbersBySeatCode[seatGradeCode]
            };
        });

        debug('updating screen...');
        await ttts.Models.Screen.findByIdAndUpdate(
            screen._id,
            screen,
            {
                new: true,
                upsert: true
            }
        ).exec();
        debug('screen updated');
    }));
    debug('promised.');
}

/**
 * jsonから劇場生成
 */
export async function createTheatersFromJson(): Promise<void> {
    const theaters: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/theaters.json`);

    await Promise.all(theaters.map(async (theater) => {
        debug('updating theater...');
        await ttts.Models.Theater.findByIdAndUpdate(
            theater._id,
            theater,
            {
                new: true,
                upsert: true
            }
        ).exec();
        debug('theater updated');
    }));
    debug('promised.');
}

/**
 * jsonから券種生成
 */
export async function createTicketTypesFromJson(): Promise<void> {
    const ticketTypes: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypes.json`);

    await Promise.all(ticketTypes.map(async (ticketType) => {
        debug('updating ticketType...');
        await ttts.Models.TicketType.findByIdAndUpdate(
            ticketType._id,
            ticketType,
            {
                new: true,
                upsert: true
            }
        ).exec();
        debug('ticketType updated');
    }));
    debug('promised.');
}

/**
 * jsonから券種グループ生成
 */
export async function createTicketTypeGroupsFromJson(): Promise<void> {
    const ticketTypeGroups: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypeGroups.json`);

    await Promise.all(ticketTypeGroups.map(async (ticketTypeGroup) => {
        debug('updating ticketTypeGroup...');
        await ttts.Models.TicketTypeGroup.findByIdAndUpdate(
            ticketTypeGroup._id,
            ticketTypeGroup,
            {
                new: true,
                upsert: true
            }
        ).exec();
        debug('ticketTypeGroup updated');
    }));
    debug('promised.');
}
