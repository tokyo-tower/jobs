/**
 * 成立取引監視
 *
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

const debug = createDebug('ttts-jobs:*');

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

let countExecute = 0;

const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
const INTERVAL_MILLISECONDS = 500;

setInterval(
    async () => {
        if (countExecute > MAX_NUBMER_OF_PARALLEL_TASKS) {
            return;
        }

        countExecute += 1;

        try {
            debug('exporting tasks...');
            await ttts.service.transaction.placeOrder.exportTasks(
                ttts.factory.transactionStatusType.Confirmed
            );
        } catch (error) {
            console.error(error.message);
        }

        countExecute -= 1;
    },
    INTERVAL_MILLISECONDS
);
