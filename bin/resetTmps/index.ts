/**
 * task name
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as reservationController from '../../app/controllers/reservation';
import * as reservationPerHourController from '../../app/controllers/reservationPerHour';

async function main(): Promise<void> {
    ttts.mongoose.connect(<string>process.env.MONGOLAB_URI);
    await reservationController.resetTmps();
    await reservationPerHourController.resetTmps();
    ttts.mongoose.disconnect();
}

// tslint:disable-next-line:no-floating-promises
main().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error(err);
});
