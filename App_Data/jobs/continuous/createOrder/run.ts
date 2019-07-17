/**
 * 注文作成
 * @ignore
 */

import * as ttts from '@tokyotower/domain';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

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
const INTERVAL_MILLISECONDS = 200;
const taskRepository = new ttts.repository.Task(ttts.mongoose.connection);

setInterval(
    async () => {
        if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
            return;
        }

        count += 1;

        try {
            await ttts.service.task.executeByName(
                ttts.factory.taskName.CreateOrder
            )(taskRepository, ttts.mongoose.connection, redisClient);
        } catch (error) {
            console.error(error.message);
        }

        count -= 1;
    },
    INTERVAL_MILLISECONDS
);
