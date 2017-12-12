/**
 * 取引期限監視
 *
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';

import mongooseConnectionOptions from '../../../../app/mongooseConnectionOptions';

const debug = createDebug('ttts-jobs:*');

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

let count = 0;

const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
const INTERVAL_MILLISECONDS = 1000;
const transactionRepository = new ttts.repository.Transaction(ttts.mongoose.connection);

setInterval(
    async () => {
        if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
            return;
        }

        count += 1;

        try {
            debug('transaction expiring...');
            await transactionRepository.makeExpired();
        } catch (error) {
            console.error(error.message);
        }

        count -= 1;
    },
    INTERVAL_MILLISECONDS
);
