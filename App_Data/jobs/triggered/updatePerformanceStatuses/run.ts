/**
 * パフォーマンス在庫状況を更新する
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';

import mongooseConnectionOptions from '../../../../app/mongooseConnectionOptions';

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
const redisClient = ttts.redis.createClient(
    // tslint:disable-next-line:no-magic-numbers
    parseInt(<string>process.env.TTTS_PERFORMANCE_STATUSES_REDIS_PORT, 10),
    <string>process.env.TTTS_PERFORMANCE_STATUSES_REDIS_HOST,
    {
        password: process.env.TTTS_PERFORMANCE_STATUSES_REDIS_KEY,
        tls: { servername: process.env.TTTS_PERFORMANCE_STATUSES_REDIS_HOST },
        return_buffers: true
    }
);

ttts.service.itemAvailability.updatePerformanceStatuses()(
    new ttts.repository.Stock(ttts.mongoose.connection),
    new ttts.repository.Performance(ttts.mongoose.connection),
    new ttts.repository.PerformanceStatuses(redisClient)
)
    .catch((err) => {
        console.error(err);
    })
    .then(() => {
        ttts.mongoose.disconnect();
        redisClient.quit();
    });
