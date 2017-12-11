/**
 * 劇場タスクコントローラー
 *
 * @namespace TheaterController
 */

import * as ttts from '@motionpicture/ttts-domain';

import * as createDebug from 'debug';
import * as fs from 'fs-extra';

const debug = createDebug('ttts-jobs:controller:theater');

/**
 *
 * @memberOf TheaterController
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
        seatsNumbersBySeatCode[ttts.factory.place.screen.SeatGrade.Normal] = 0;
        seatsNumbersBySeatCode[ttts.factory.place.screen.SeatGrade.PremiereBox] = 0;
        seatsNumbersBySeatCode[ttts.factory.place.screen.SeatGrade.PremiereLuxury] = 0;
        seatsNumbersBySeatCode[ttts.factory.place.screen.SeatGrade.FrontReclining] = 0;
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
 *
 * @memberOf TheaterController
 */
export async function createFromJson(): Promise<void> {
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
