/**
 * 在庫を新リポジトリへ移行
 */
const ttts = require('@motionpicture/ttts-domain');
const moment = require('moment');

const redisClient = ttts.redis.createClient({
    // tslint:disable-next-line:no-magic-numbers
    port: Number(process.env.REDIS_PORT),
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});

async function main() {
    await ttts.mongoose.connect(process.env.MONGOLAB_URI);
    const oldStockRepo = new ttts.repository.OldStock(ttts.mongoose.connection);
    const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);
    const stockRepo = new ttts.repository.Stock(redisClient);

    // 未来開催予定のパフォーマンス検索
    const ids = await performanceRepo.distinct('_id', {
        startFrom: moment().add(-1, 'week').toDate()
    });
    console.log(ids.length, 'performances found');

    // パフォーマンスごとにOutOfStockなストックを検索し、Redisへ移行
    const expires = moment().add(1, 'year').toDate();
    for (const key of Object.keys(ids)) {
        // const performanceId = '190602001001010900';
        const performanceId = ids[key];
        console.log('processing...', key, performanceId);

        const unavailableStocks = await oldStockRepo.stockModel.find({
            performance: performanceId,
            availability: ttts.factory.itemAvailability.OutOfStock
        }).exec().then((docs) => docs.map((doc) => doc.toObject()));
        // console.log(unavailableStocks);
        console.log(unavailableStocks.length, 'unavailable stocks found');

        await Promise.all(unavailableStocks.map(async (stock) => {
            const holder = await stockRepo.getHolder({
                eventId: performanceId,
                offer: { seatSection: '', seatNumber: stock.seat_code }
            });
            if (holder === null) {
                await stockRepo.lock({
                    eventId: performanceId,
                    offers: [{ seatSection: '', seatNumber: stock.seat_code }],
                    expires: expires,
                    holder: stock.holder
                });
            }
        }));
        console.log('migrated', key, performanceId);
    }
}

main().then(() => {
    console.log('success!');
}).catch(console.error);