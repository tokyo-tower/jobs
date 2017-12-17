/**
 * パフォーマンスの対する返品実行
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';

import mongooseConnectionOptions from '../../../../app/mongooseConnectionOptions';

const debug = createDebug('ttts-jobs:continuous:settleCreditCard');

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
const redisClient = ttts.redis.createClient(
    {
        host: <string>process.env.REDIS_HOST,
        // tslint:disable-next-line:no-magic-numbers
        port: parseInt(<string>process.env.REDIS_PORT, 10),
        password: <string>process.env.REDIS_KEY,
        tls: { servername: <string>process.env.REDIS_HOST }
    }
);

let count = 0;

const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
const INTERVAL_MILLISECONDS = 1000;
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
                ttts.factory.taskName.ReturnOrdersByPerformance
            )(taskRepository, ttts.mongoose.connection, redisClient);
        } catch (error) {
            console.error(error.message);
        }

        count -= 1;
    },
    INTERVAL_MILLISECONDS
);
