/**
 * task name
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as emailQueueController from '../../app/controllers/emailQueue';

import mongooseConnectionOptions from '../../mongooseConnectionOptions';

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
            await emailQueueController.sendOne();
        } catch (error) {
            console.error(error);
        }

        count -= 1;
    },
    INTERVAL_MILLISECONDS
);
