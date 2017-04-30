/**
 * 券種グループタスクコントローラー
 *
 * @namespace TicketTypeGroupController
 */

import { Models } from '@motionpicture/chevre-domain';

import * as createDebug from 'debug';
import * as fs from 'fs-extra';
import * as mongoose from 'mongoose';

const debug = createDebug('chevre-api:task:controller:ticketTypeGroup');

const MONGOLAB_URI = process.env.MONGOLAB_URI;

/**
 * @memberOf FilmController
 */
export function createFromJson(): void {
    mongoose.connect(MONGOLAB_URI, {});

    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypeGroups.json`, 'utf8', async (err, data) => {
        if (err instanceof Error) {
            throw err;
        }
        const ticketTypeGroups: any[] = JSON.parse(data);

        const promises = ticketTypeGroups.map(async (ticketTypeGroup) => {
            debug('updating ticketTypeGroup...');
            await Models.TicketTypeGroup.findOneAndUpdate(
                {
                    _id: ticketTypeGroup._id
                },
                ticketTypeGroup,
                {
                    new: true,
                    upsert: true
                }
            ).exec();
            debug('ticketTypeGroup updated');
        });

        await Promise.all(promises);
        debug('promised.');
        mongoose.disconnect();
        process.exit(0);
    });
}
