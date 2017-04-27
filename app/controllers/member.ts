/**
 * メルマガ会員タスクコントローラー
 *
 * @namespace MemberController
 */

import { CommonUtil, Models } from '@motionpicture/chevre-domain';

import * as crypto from 'crypto';
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
 *
 * @memberOf MemberController
 */
export function createFromJson() {
    mongoose.connect(MONGOLAB_URI, {});

    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/members.json`, 'utf8', async (err, data) => {
        if (err instanceof Error) throw err;
        let members: any[] = JSON.parse(data);

        // パスワードハッシュ化
        members = members.map((member) => {
            const SIZE = 64;
            const passwordSalt = crypto.randomBytes(SIZE).toString('hex');
            return {
                user_id: member.user_id,
                password_salt: passwordSalt,
                password_hash: CommonUtil.createHash(member.password, passwordSalt)
            };
        });
        logger.info('removing all members...');
        await Models.Member.remove({}).exec();

        logger.debug('creating members...');
        await Models.Member.create(members);
        logger.info('members created.');
        mongoose.disconnect();
        process.exit(0);
    });
}

/**
 *
 *
 * @memberOf MemberController
 */
export function createReservationsFromJson() {
    mongoose.connect(MONGOLAB_URI, {});

    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/memberReservations.json`, 'utf8', async (err, data) => {
        if (err instanceof Error) throw err;
        const reservations: any[] = JSON.parse(data);

        logger.debug('creating reservations...');
        const promises = reservations.map(async (reservationFromJson) => {
            logger.info('removing reservation...');
            // すでに予約があれば削除してから新規作成
            await Models.Reservation.remove(
                {
                    performance: reservationFromJson.performance,
                    seat_code: reservationFromJson.seat_code
                }
            ).exec();
            logger.info('reservation removed.');

            logger.info('creating reservationFromJson...', reservationFromJson);
            await Models.Reservation.create(reservationFromJson);
            logger.info('reservationFromJson created.');
        });

        await Promise.all(promises);
        logger.info('promised.');
        mongoose.disconnect();
        process.exit(0);
    });
}
