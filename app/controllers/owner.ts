/**
 * オーナータスクコントローラー
 *
 * @namespace controller/owner
 */

import * as chevre from '@motionpicture/chevre-domain';

import * as crypto from 'crypto';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';

const debug = createDebug('chevre-jobs:controller:staff');

/**
 *
 * @memberOf controller/owner
 */
export async function createFromJson(): Promise<void> {
    const owners: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/owners.json`);

    // あれば更新、なければ追加
    await Promise.all(owners.map(async (owner) => {
        // パスワードハッシュ化
        const SIZE = 64;
        const passwordSalt = crypto.randomBytes(SIZE).toString('hex');
        owner.password_salt = passwordSalt;
        owner.password_hash = chevre.CommonUtil.createHash(owner.password, passwordSalt);

        debug('updating owner...');
        await chevre.Models.Owner.findOneAndUpdate(
            {
                username: owner.username
            },
            owner,
            {
                new: true,
                upsert: true
            }
        ).exec();
        debug('owner updated');
    }));
    debug('promised.');
}
