/**
 * メルマガ会員タスクコントローラー
 *
 * @namespace MemberController
 */

import { CommonUtil, Models } from '@motionpicture/chevre-domain';

import * as crypto from 'crypto';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';

const debug = createDebug('chevre-jobs:controller:member');

/**
 *
 *
 * @memberOf MemberController
 */
export async function createFromJson(): Promise<void> {
    let members: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/members.json`);

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
}

/**
 *
 *
 * @memberOf MemberController
 */
export async function createReservationsFromJson(): Promise<void> {
    const reservations: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/memberReservations.json`);

    debug('creating reservations...');
    await Promise.all(reservations.map(async (reservationFromJson) => {
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
    }));
    debug('promised.');
}
