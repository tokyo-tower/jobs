/**
 * 当日窓口アカウントタスクコントローラー
 *
 * @namespace WindowController
 */

import { CommonUtil, Models } from '@motionpicture/chevre-domain';

import * as crypto from 'crypto';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';

const debug = createDebug('chevre-jobs:controller:window');

/**
 *
 * @memberOf WindowController
 */
export async function createFromJson(): Promise<void> {
    let windows: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/windows.json`);

    // パスワードハッシュ化
    windows = windows.map((window) => {
        const SIZE = 64;
        const passwordSalt = crypto.randomBytes(SIZE).toString('hex');
        window.password_salt = passwordSalt;
        window.password_hash = CommonUtil.createHash(window.password, passwordSalt);
        return window;
    });

    debug('removing all windows...');
    await Models.Window.remove({}).exec();
    debug('creating windows...');
    await Models.Window.create(windows);
    debug('windows created.');
}
