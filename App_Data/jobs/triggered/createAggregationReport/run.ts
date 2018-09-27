/**
 * 売上レポートに対する集計データを更新する
 * @ignore
 */
/* tslint:disable:no-console */
/* tslint:disable:no-magic-numbers */
import * as ttts from '@motionpicture/ttts-domain';
import * as moment from 'moment-timezone';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';
ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

const redisClient = ttts.redis.createClient({
    host: <string>process.env.REDIS_HOST,
    port: parseInt(<string>process.env.REDIS_PORT, 10),
    password: <string>process.env.REDIS_KEY,
    tls: { servername: <string>process.env.REDIS_HOST }
});

main().then(() => {
    ttts.mongoose.disconnect();
    redisClient.quit();
});

async function main() {
    // 前日を集計する。UTC時間と日本時間に注意！！
    // 日本時間の深夜にバッチを起動するということは、UTC時間だとまだ日付が変わってない。
    // const targetDate = moment().add('day', -1).format('YYYY/MM/DD');
    let targetDates : string[] = [];
    if (process.argv.length === 3) {
        targetDates = process.argv[2].split(',').map((key: string) => {
            return moment(key, 'YYYYMMDD').format('YYYY/MM/DD');
        });
    } else {
        targetDates = [moment().format('YYYY/MM/DD')];
    }

    for (const targetDate of targetDates) {

        console.log(`byEndDate:${targetDate}`);
        try {
            await ttts.service.aggregate.report4sales.aggregateSalesByEndDate(
                targetDate
            )(
                new ttts.repository.Reservation(ttts.mongoose.connection),
                new ttts.repository.Transaction(ttts.mongoose.connection),
                new ttts.repository.AggregateSale(ttts.mongoose.connection)
            );
        } catch (error) {
            console.log(`error byEndDate:${targetDate}`);
        }

        console.log(`byEventStartDate:${targetDate}`);
        try {
            await ttts.service.aggregate.report4sales.aggregateSalesByEventStartDate(
                targetDate
            )(
                new ttts.repository.Reservation(ttts.mongoose.connection),
                new ttts.repository.Transaction(ttts.mongoose.connection),
                new ttts.repository.AggregateSale(ttts.mongoose.connection)
            );
        } catch (error) {
            console.log(`error byEventStartDate:${targetDate}`);
        }

        const suspensionRepo = new ttts.repository.itemAvailability.Suspension(redisClient);
        await suspensionRepo.deleteKey(moment(targetDate, 'YYYY/MM/DD').format('YYYYMMDD'));

        console.log(`${targetDate} Completed!`);
    }
}
