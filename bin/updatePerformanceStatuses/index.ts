/**
 * task name
 *
 * @ignore
 */

import * as mongoose from 'mongoose';
import * as performanceController from '../../app/controllers/performance';

async function main(): Promise<void> {
    mongoose.connect(<string>process.env.MONGOLAB_URI);
    await performanceController.updateStatuses();
    mongoose.disconnect();
}

// tslint:disable-next-line:no-floating-promises
main().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error(err);
});
