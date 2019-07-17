/**
 * 取引キューエクスポートが実行中のままになっている取引を監視する
 *
 * @ignore
 */

import * as ttts from '@tokyotower/domain';
import * as createDebug from 'debug';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

const debug = createDebug('ttts-jobs:*');

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

let countRetry = 0;

const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
const INTERVAL_MILLISECONDS = 500;
const transactionRepository = new ttts.repository.Transaction(ttts.mongoose.connection);
const RETRY_INTERVAL_MINUTES = 10;

setInterval(
    async () => {
        if (countRetry > MAX_NUBMER_OF_PARALLEL_TASKS) {
            return;
        }

        countRetry += 1;

        try {
            debug('reexporting tasks...');
            await transactionRepository.reexportTasks(RETRY_INTERVAL_MINUTES);
        } catch (error) {
            console.error(error.message);
        }

        countRetry -= 1;
    },
    INTERVAL_MILLISECONDS
);
