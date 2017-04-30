/**
 * 券種タスクコントローラー
 *
 * @namespace controller/ticketType
 */

import { Models } from '@motionpicture/chevre-domain';

import * as createDebug from 'debug';
import * as fs from 'fs-extra';

const debug = createDebug('chevre-jobs:controller:ticketType');

/**
 * @memberOf controller/ticketType
 */
export async function createFromJson(): Promise<void> {
    const ticketTypes: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypes.json`);

    await Promise.all(ticketTypes.map(async (ticketType) => {
        debug('updating ticketType...');
        await Models.TicketType.findByIdAndUpdate(
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
