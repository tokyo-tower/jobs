/**
 * 券種タスクコントローラー
 *
 * @namespace TicketTypeController
 */

import { Models } from '@motionpicture/chevre-domain';

import * as createDebug from 'debug';
import * as fs from 'fs-extra';
import * as mongoose from 'mongoose';

const debug = createDebug('chevre-api:task:controller:ticketType');

/**
 * @memberOf FilmController
 */
export function createFromJson(): void {
    mongoose.connect(process.env.MONGOLAB_URI, {});

    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypes.json`, 'utf8', async (err, data) => {
        if (err instanceof Error) {
            throw err;
        }
        const ticketTypes: any[] = JSON.parse(data);

        const promises = ticketTypes.map(async (ticketType) => {
            debug('updating ticketType...');
            await Models.TicketType.findOneAndUpdate(
                {
                    _id: ticketType._id
                },
                ticketType,
                {
                    new: true,
                    upsert: true
                }
            ).exec();
            debug('ticketType updated');
        });

        await Promise.all(promises);
        debug('promised.');
        mongoose.disconnect();
        process.exit(0);
    });
}
