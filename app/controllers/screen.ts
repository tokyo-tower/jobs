/**
 * パフォーマンスタスクコントローラー
 *
 * @namespace controller/screen
 */

import { Models } from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import * as fs from 'fs-extra';

const debug = createDebug('ttts-jobs:controller:performance');
/**
 *
 *
 * @memberOf controller/performance
 */
export async function createFromJson(): Promise<void> {
    const screens: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/screens.json`);
    await Promise.all(screens.map(async (screen) => {
        debug('updating ticketType...');
        await Models.Screen.findByIdAndUpdate(
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
