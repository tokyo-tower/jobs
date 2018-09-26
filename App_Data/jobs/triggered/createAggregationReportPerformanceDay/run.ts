/**
 * staffの販売停止一覧で返金処理の処理実行
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
});

async function main() {
    //process.argv.push('20180901,20180902');

    let performanceDays: string[] = [];
    if (process.argv.length === 3) {
        performanceDays = process.argv[2].split(',').map((key: string) => {
            return moment(key, 'YYYYMMDD').format('YYYY/MM/DD');
        });
    } else {
        const suspensionRepo = new ttts.repository.itemAvailability.Suspension(redisClient);
        const keysPerformance = await suspensionRepo.findKeys();

        performanceDays = keysPerformance.map((key: string) => {
            return moment(key.replace(/performanceDay/gi, ''), 'YYYYMMDD').format('YYYY/MM/DD');
        });
    }

    for (const performanceDay of performanceDays) {
        console.log(`byEndDate:${performanceDay}`);
        try {
            await ttts.service.aggregate.report4sales.aggregateSalesByEndDate(
                performanceDay
            )(
                new ttts.repository.Reservation(ttts.mongoose.connection),
                new ttts.repository.Transaction(ttts.mongoose.connection),
                new ttts.repository.AggregateSale(ttts.mongoose.connection)
            );
        } catch (error) {
            console.log(`error byEndDate:${performanceDay}`);
        }

        console.log(`byEventStartDate:${performanceDay}`);
        try {
            await ttts.service.aggregate.report4sales.aggregateSalesByEventStartDate(
                performanceDay
            )(
                new ttts.repository.Reservation(ttts.mongoose.connection),
                new ttts.repository.Transaction(ttts.mongoose.connection),
                new ttts.repository.AggregateSale(ttts.mongoose.connection)
            );
        } catch (error) {
            console.log(`error byEventStartDate:${performanceDay}`);
        }

        if (process.argv.length !== 3) {
            const suspensionRepo = new ttts.repository.itemAvailability.Suspension(redisClient);
            await suspensionRepo.deleteKey(moment(performanceDay, 'YYYY/MM/DD').format('YYYYMMDD'));
        }
        console.log(`${performanceDay} Completed!`);
    }
}
