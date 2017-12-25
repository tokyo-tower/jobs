/**
 * 期限切れ取引監視
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

let countExecute = 0;

const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
const INTERVAL_MILLISECONDS = 200;

setInterval(
    async () => {
        if (countExecute > MAX_NUBMER_OF_PARALLEL_TASKS) {
            return;
        }

        countExecute += 1;

        try {
            await ttts.service.transaction.placeOrder.exportTasks(
                ttts.factory.transactionStatusType.Expired
            );
        } catch (error) {
            console.error(error.message);
        }

        countExecute -= 1;
    },
    INTERVAL_MILLISECONDS
);
