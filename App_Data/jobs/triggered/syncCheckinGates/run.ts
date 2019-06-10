/**
 * 入場ゲート情報を、所有者リポジトリから同期する
 */
import * as ttts from '@motionpicture/ttts-domain';
import * as AWS from 'aws-sdk';
import * as createDebug from 'debug';

const debug = createDebug('ttts-jobs:syncCheckinGates');

const redisClient = ttts.redis.createClient({
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(<string>process.env.REDIS_PORT, 10),
    host: <string>process.env.REDIS_HOST,
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});

const checkinGateRepo = new ttts.repository.place.CheckinGate(redisClient);

// Cognitoからグループリストを取得して、入場ゲートリポジトリーに保管する
getCognitoGroups().then(async (groups) => {
    const checkinGates = groups.map((group) => {
        return {
            identifier: <string>group.GroupName,
            name: <string>group.Description
        };
    });
    debug('storing checkinGates...', checkinGates);

    await Promise.all(checkinGates.map(async (checkinGate) => {
        try {
            await checkinGateRepo.store(checkinGate);
        } catch (error) {
            // tslint:disable-next-line:no-console
            console.error(error);
        }
    }));
}).catch((error) => {
    // tslint:disable-next-line:no-console
    console.error(error);
}).then(async () => {
    redisClient.quit();
});

async function getCognitoGroups() {
    return new Promise<AWS.CognitoIdentityServiceProvider.GroupListType>((resolve, reject) => {
        const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
            apiVersion: 'latest',
            region: 'ap-northeast-1',
            accessKeyId: <string>process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: <string>process.env.AWS_SECRET_ACCESS_KEY
        });

        cognitoIdentityServiceProvider.listGroups(
            {
                UserPoolId: <string>process.env.COGNITO_USER_POOL_ID
            },
            (err, data) => {
                debug('listGroups result:', err, data);
                if (err instanceof Error) {
                    reject(err);
                } else {
                    if (data.Groups === undefined) {
                        reject(new Error('Unexpected.'));
                    } else {
                        resolve(data.Groups);
                    }
                }
            });
    });
}
