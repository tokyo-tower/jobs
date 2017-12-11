/**
 * create reservations
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as gmoController from '../../app/controllers/gmo';

async function main(): Promise<void> {
    ttts.mongoose.connect(<string>process.env.MONGOLAB_URI);
    await gmoController.refundForSuspend();
    ttts.mongoose.disconnect();
}

// tslint:disable-next-line:no-floating-promises
main().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error(err);
    process.exit(-1);
});
