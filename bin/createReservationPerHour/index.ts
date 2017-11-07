/**
 * create reservations
 *
 * @ignore
 */
import * as mongoose from 'mongoose';
import * as reservationPerHourController from '../../app/controllers/reservationPerHour';

async function main(): Promise<void> {
    mongoose.connect(process.env.MONGOLAB_URI);
    await reservationPerHourController.createFromSetting();
    mongoose.disconnect();
}

// tslint:disable-next-line:no-floating-promises
main().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error(err);
    process.exit(-1);
});
