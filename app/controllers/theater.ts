/**
 * 劇場タスクコントローラー
 *
 * @namespace TheaterController
 */

import { Models } from '@motionpicture/chevre-domain';
import { ScreenUtil } from '@motionpicture/chevre-domain';

import * as fs from 'fs-extra';
import * as log4js from 'log4js';
import * as mongoose from 'mongoose';

const MONGOLAB_URI = process.env.MONGOLAB_URI;

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
 * @memberOf TheaterController
 */
export function createScreensFromJson(): void {
    mongoose.connect(MONGOLAB_URI, {});

    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/screens.json`, 'utf8', async (err, data) => {
        if (err instanceof Error) {
            throw err;
        }
        const screens: any[] = JSON.parse(data);

        const promises = screens.map(async (screen) => {
            // 座席数情報を追加
            screen.seats_number = screen.sections[0].seats.length;

            // 座席グレードごとの座席数情報を追加
            const seatsNumbersBySeatCode: {
                [key: string]: number
            } = {};
            seatsNumbersBySeatCode[ScreenUtil.SEAT_GRADE_CODE_NORMAL] = 0;
            seatsNumbersBySeatCode[ScreenUtil.SEAT_GRADE_CODE_PREMIERE_BOX] = 0;
            seatsNumbersBySeatCode[ScreenUtil.SEAT_GRADE_CODE_PREMIERE_LUXURY] = 0;
            seatsNumbersBySeatCode[ScreenUtil.SEAT_GRADE_CODE_FRONT_RECLINING] = 0;
            screen.sections[0].seats.forEach((seat: any) => {
                seatsNumbersBySeatCode[seat.grade.code] += 1;
            });
            screen.seats_numbers_by_seat_grade = Object.keys(seatsNumbersBySeatCode).map((seatGradeCode) => {
                return {
                    seat_grade_code: seatGradeCode,
                    seats_number: seatsNumbersBySeatCode[seatGradeCode]
                };
            });

            logger.debug('updating screen...');
            await Models.Screen.findOneAndUpdate(
                {
                    _id: screen._id
                },
                screen,
                {
                    new: true,
                    upsert: true
                }
            ).exec();
            logger.debug('screen updated');
        });

        await Promise.all(promises);
        logger.info('promised.');
        mongoose.disconnect();
        process.exit(0);
    });
}

/**
 *
 * @memberOf TheaterController
 */
export function createFromJson(): void {
    mongoose.connect(MONGOLAB_URI, {});
    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/theaters.json`, 'utf8', async (err, data) => {
        if (err instanceof Error) {
            throw err;
        }
        const theaters: any[] = JSON.parse(data);

        const promises = theaters.map(async (theater) => {
            logger.debug('updating theater...');
            await Models.Theater.findOneAndUpdate(
                {
                    _id: theater._id
                },
                theater,
                {
                    new: true,
                    upsert: true
                }
            ).exec();
            logger.debug('theater updated');
        });

        await Promise.all(promises);
        logger.info('promised.');
        mongoose.disconnect();
        process.exit(0);
    });
}
