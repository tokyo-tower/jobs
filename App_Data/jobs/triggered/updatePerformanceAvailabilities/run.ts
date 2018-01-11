/**
 * パフォーマンス在庫状況を更新する
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
const redisClient = ttts.redis.createClient({
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(<string>process.env.REDIS_PORT, 10),
    host: <string>process.env.REDIS_HOST,
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});

ttts.service.itemAvailability.updatePerformanceAvailabilities(
    // tslint:disable-next-line:no-magic-numbers
    parseInt(<string>process.env.UPDATE_PERFORMANCE_AVAILABILITY_PERIOD_IN_DAYS, 10),
    // tslint:disable-next-line:no-magic-numbers
    parseInt(<string>process.env.PERFORMANCE_AVAILABILITY_EXPIRES_IN_SECONDS, 10)
)(
    new ttts.repository.Stock(ttts.mongoose.connection),
    new ttts.repository.Performance(ttts.mongoose.connection),
    new ttts.repository.itemAvailability.Performance(redisClient)
    )
    .catch((err) => {
        console.error(err);
    })
    .then(() => {
        ttts.mongoose.disconnect();
        redisClient.quit();
    });
