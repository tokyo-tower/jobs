/**
 * create ticketTypes
 *
 * @ignore
 */

import * as mongoose from 'mongoose';

import * as ticketTypeController from '../../app/controllers/ticketType';

async function main(): Promise<void> {
    mongoose.connect(process.env.MONGOLAB_URI);
    await ticketTypeController.createFromJson();
    mongoose.disconnect();
}

// tslint:disable-next-line:no-floating-promises
main().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error(err);
    process.exit(-1);
});
