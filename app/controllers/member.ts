/**
 * メルマガ会員タスクコントローラー
 *
 * @namespace MemberController
 */

import { CommonUtil, Models } from '@motionpicture/chevre-domain';

import * as crypto from 'crypto';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';
import * as mongoose from 'mongoose';

const debug = createDebug('chevre-jobs:controller:member');

/**
 *
 *
 * @memberOf MemberController
 */
export function createFromJson() {
    mongoose.connect(process.env.MONGOLAB_URI, {});

    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/members.json`, 'utf8', async (err, data) => {
        if (err instanceof Error) {
            throw err;
        }
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
        debug('removing all members...');
        await Models.Member.remove({}).exec();

        debug('creating members...');
        await Models.Member.create(members);
        debug('members created.');
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
    mongoose.connect(process.env.MONGOLAB_URI, {});

    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/memberReservations.json`, 'utf8', async (err, data) => {
        if (err instanceof Error) {
            throw err;
        }
        const reservations: any[] = JSON.parse(data);

        debug('creating reservations...');
        const promises = reservations.map(async (reservationFromJson) => {
            debug('removing reservation...');
            // すでに予約があれば削除してから新規作成
            await Models.Reservation.remove(
                {
                    performance: reservationFromJson.performance,
                    seat_code: reservationFromJson.seat_code
                }
            ).exec();
            debug('reservation removed.');

            debug('creating reservationFromJson...', reservationFromJson);
            await Models.Reservation.create(reservationFromJson);
            debug('reservationFromJson created.');
        });

        await Promise.all(promises);
        debug('promised.');
        mongoose.disconnect();
        process.exit(0);
    });
}
