/**
 * 作品タスクコントローラー
 *
 * @namespace FilmController
 */

import { Models } from '@motionpicture/ttts-domain';

import * as createDebug from 'debug';
import * as fs from 'fs-extra';

const debug = createDebug('ttts-jobs:controller:film');

/**
 * @memberOf FilmController
 */
export function createTicketTypeGroupsFromJson(): void {
    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypeGroups.json`, 'utf8', async (err, data) => {
        if (err instanceof Error) {
            throw err;
        }
        const groups = JSON.parse(data);

        debug('removing all groups...');
        await Models.TicketTypeGroup.remove({}).exec();

        debug('creating groups...');
        await Models.TicketTypeGroup.create(groups);
        debug('groups created.');
    });
}

/**
 * @memberOf FilmController
 */
export async function createFromJson(): Promise<void> {
    const films: any[] = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/films.json`);

    await Promise.all(films.map(async (film) => {
        debug('updating film...');
        await Models.Film.findByIdAndUpdate(
            film._id,
            film,
            {
                new: true,
                upsert: true
            }
        ).exec();
        debug('film updated');
    }));
    debug('promised.');
}
