/**
 * 当日窓口アカウントタスクコントローラー
 *
 * @namespace WindowController
 */

import { CommonUtil, Models } from '@motionpicture/chevre-domain';

import * as crypto from 'crypto';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';
import * as mongoose from 'mongoose';

const debug = createDebug('chevre-jobs:controller:window');

/**
 *
 * @memberOf WindowController
 */
export function createFromJson() {
    mongoose.connect(process.env.MONGOLAB_URI, {});

    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/windows.json`, 'utf8', (err, data) => {
        if (err instanceof Error) {
            throw err;
        }
        let windows: any[] = JSON.parse(data);

        // パスワードハッシュ化
        windows = windows.map((window) => {
            const SIZE = 64;
            const passwordSalt = crypto.randomBytes(SIZE).toString('hex');
            window.password_salt = passwordSalt;
            window.password_hash = CommonUtil.createHash(window.password, passwordSalt);
            return window;
        });

        debug('removing all windows...');
        Models.Window.remove({}, async (removeErr) => {
            if (removeErr !== null) {
                throw removeErr;
            }

            debug('creating windows...');
            await Models.Window.create(windows);
            debug('windows created.');

            mongoose.disconnect();
            process.exit(0);
        });
    });
}
