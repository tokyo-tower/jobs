/**
 * GMO通知を監視する
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as gmoController from '../../../../app/controllers/gmo';
import mongooseConnectionOptions from '../../../../app/mongooseConnectionOptions';

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
let count = 0;

const INTERVAL_MILLISECONDS = 250;
const MAX_NUMBER_OF_PARALLEL_TASK = 10;
setInterval(
    async () => {
        if (count > MAX_NUMBER_OF_PARALLEL_TASK) {
            return;
        }

        count += 1;

        try {
            await gmoController.processOne();
        } catch (error) {
            console.error(error);
        }

        count -= 1;
    },
    INTERVAL_MILLISECONDS
);
