/**
 * create reservations
 *
 * @ignore
 */
import * as mongoose from 'mongoose';
import * as gmoController from '../../app/controllers/gmo';

async function main(): Promise<void> {
    mongoose.connect(<string>process.env.MONGOLAB_URI);
    await gmoController.refundForSuspend();
    mongoose.disconnect();
}

// tslint:disable-next-line:no-floating-promises
main().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error(err);
    process.exit(-1);
});
