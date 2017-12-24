/**
 * 入場ゲート情報を、所有者リポジトリーから同期する
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

const ownerRepo = new ttts.repository.Owner(ttts.mongoose.connection);
const checkinGateRepo = new ttts.repository.place.CheckinGate(redisClient);

ownerRepo.ownerModel.find({ notes: '1' })
    .exec().then(async (owners) => {
        const checkinGates = owners.map((owner) => {
            return {
                identifier: owner.get('group'),
                name: owner.get('description')
            };
        });

        await Promise.all(checkinGates.map(async (checkinGate) => {
            try {
                await checkinGateRepo.store(checkinGate);
            } catch (error) {
                console.error(error);
            }
        }));
    }).catch((error) => {
        console.error(error);
    }).then(() => {
        ttts.mongoose.disconnect();
        redisClient.quit();
    });
