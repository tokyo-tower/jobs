/**
 * 不要なイベント予約集計を削除する
 */
import * as ttts from '@tokyotower/domain';
import * as moment from 'moment';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

async function main() {
    await ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

    const redisClient = ttts.redis.createClient({
        port: Number(<string>process.env.REDIS_PORT),
        host: <string>process.env.REDIS_HOST,
        password: process.env.REDIS_KEY,
        tls: { servername: process.env.REDIS_HOST }
    });

    const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);
    const eventWithAggregationRepo = new ttts.repository.EventWithAggregation(redisClient);

    // 過去のイベントを検索
    const startThrough = moment().add(-1, 'week').toDate();
    const startFrom = moment(startThrough).add(-1, 'week').toDate();
    const eventIds = await performanceRepo.distinct('_id', {
        startFrom: startFrom,
        startThrough: startThrough
    });

    if (eventIds.length > 0) {
        await eventWithAggregationRepo.deleteByIds({ ids: eventIds });
    }

    await ttts.mongoose.disconnect();
    redisClient.quit();
}

main()
    .then()
    .catch((error) => {
        // tslint:disable-next-line:no-console
        console.error(error);
        process.exit(0);
    });
