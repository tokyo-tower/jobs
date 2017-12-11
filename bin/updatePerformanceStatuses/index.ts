/**
 * task name
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as performanceController from '../../app/controllers/performance';

async function main(): Promise<void> {
    ttts.mongoose.connect(<string>process.env.MONGOLAB_URI);
    await performanceController.updateStatuses();
    ttts.mongoose.disconnect();
}

// tslint:disable-next-line:no-floating-promises
main().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error(err);
});
