/**
 * タスクリトライ
 *
 * @ignore
 */

import * as ttts from '@tokyotower/domain';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

let count = 0;

const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
const INTERVAL_MILLISECONDS = 1000;
const RETRY_INTERVAL_MINUTES = 10;
const taskRepository = new ttts.repository.Task(ttts.mongoose.connection);

setInterval(
    async () => {
        if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
            return;
        }

        count += 1;

        try {
            await ttts.service.task.retry(RETRY_INTERVAL_MINUTES)(taskRepository);
        } catch (error) {
            console.error(error.message);
        }

        count -= 1;
    },
    INTERVAL_MILLISECONDS
);
