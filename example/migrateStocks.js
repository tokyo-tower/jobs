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
    const stockRepo = new ttts.repository.Stock(redisClient);

    const performanceId = '190602001001010900';
    const unavailableStocks = await oldStockRepo.stockModel.find({
        performance: performanceId,
        availability: ttts.factory.itemAvailability.OutOfStock
    }).exec().then((docs) => docs.map((doc) => doc.toObject()));
    console.log(unavailableStocks);
    console.log(unavailableStocks.length, 'stocks found');

    await Promise.all(unavailableStocks.map(async (stock) => {
        await stockRepo.lock({
            eventId: performanceId,
            offers: [{ seatSection: '', seatNumber: stock.seat_code }],
            expires: moment().add(6, 'months').toDate(),
            holder: stock.holder
        });
    }));
}

main().then(() => {
    console.log('success!');
}).catch(console.error);