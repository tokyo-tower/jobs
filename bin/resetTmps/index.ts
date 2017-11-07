/**
 * task name
 *
 * @ignore
 */

import * as mongoose from 'mongoose';
import * as reservationController from '../../app/controllers/reservation';
import * as reservationPerHourController from '../../app/controllers/reservationPerHour';

async function main(): Promise<void> {
    mongoose.connect(process.env.MONGOLAB_URI);
    await reservationController.resetTmps();
    await reservationPerHourController.resetTmps();
    mongoose.disconnect();
}

// tslint:disable-next-line:no-floating-promises
main().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error(err);
});
