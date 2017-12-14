/**
 * 返品実行
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';

import mongooseConnectionOptions from '../../../../app/mongooseConnectionOptions';

const debug = createDebug('ttts-jobs:continuous:settleCreditCard');

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

let count = 0;

const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
const INTERVAL_MILLISECONDS = 500;
const taskRepository = new ttts.repository.Task(ttts.mongoose.connection);

setInterval(
    async () => {
        if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
            return;
        }

        count += 1;

        try {
            debug('count:', count);
            await ttts.service.task.executeByName(
                ttts.factory.taskName.ReturnOrder
            )(taskRepository, ttts.mongoose.connection);
        } catch (error) {
            console.error(error.message);
        }

        count -= 1;
    },
    INTERVAL_MILLISECONDS
);
