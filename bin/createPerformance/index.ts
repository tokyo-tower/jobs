/**
 * create performances and reservations
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as performanceController from '../../app/controllers/performance';

import mongooseConnectionOptions from '../../mongooseConnectionOptions';

async function main(): Promise<void> {
    ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
    await performanceController.createFromSetting();
    ttts.mongoose.disconnect();
}

// tslint:disable-next-line:no-floating-promises
main().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error(err);
    process.exit(-1);
});
