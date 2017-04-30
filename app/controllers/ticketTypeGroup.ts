/**
 * 券種グループタスクコントローラー
 *
 * @namespace controller/ticketTypeGroup
 */

import { Models } from '@motionpicture/chevre-domain';

import * as createDebug from 'debug';
import * as fs from 'fs-extra';

const debug = createDebug('chevre-jobs:controller:ticketTypeGroup');

/**
 * @memberOf controller/ticketTypeGroup
 */
export async function createFromJson(): Promise<void> {
    const ticketTypeGroups: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypeGroups.json`);

    await Promise.all(ticketTypeGroups.map(async (ticketTypeGroup) => {
        debug('updating ticketTypeGroup...');
        await Models.TicketTypeGroup.findByIdAndUpdate(
            ticketTypeGroup._id,
            ticketTypeGroup,
            {
                new: true,
                upsert: true
            }
        ).exec();
        debug('ticketTypeGroup updated');
    }));
    debug('promised.');
}
