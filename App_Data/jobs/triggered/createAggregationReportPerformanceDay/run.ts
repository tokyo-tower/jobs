/**
 * staffの販売停止一覧で返金処理の処理実行
 * @ignore
 */
/* tslint:disable:no-console */
/* tslint:disable:no-magic-numbers */
import * as ttts from '@motionpicture/ttts-domain';
import * as kick from 'request';
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
    const suspensionRepo = new ttts.repository.itemAvailability.Suspension(redisClient);
    const keysPerformance = await suspensionRepo.findKeys();

    const performanceDays: string = keysPerformance.map((key: string) => {
        return key.replace(/performanceDay/gi, '');
    }).join(',');

    if (performanceDays) {

        const aggregationUrl = `${process.env.JOBS_ENDPOINT}/api/triggeredwebjobs/createAggregationReport/run?arguments=${performanceDays}`;
        const auth = `Basic ${Buffer.from(`${process.env.JOBS_UID}:${process.env.JOBS_ENCRYPTED_PASSWORD}`).toString('base64')}`;
        const attribute = {
            uri: aggregationUrl,
            headers: { Authorization: auth }
        };

        console.log(`createAggregationReportに${performanceDays}で渡す`);
        await kick.post(attribute);
    }
}
