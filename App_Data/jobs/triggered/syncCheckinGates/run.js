"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 入場ゲート情報を、所有者リポジトリから同期する
 */
const ttts = require("@tokyotower/domain");
const AWS = require("aws-sdk");
const createDebug = require("debug");
const debug = createDebug('ttts-jobs:syncCheckinGates');
const redisClient = ttts.redis.createClient({
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(process.env.REDIS_PORT, 10),
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});
const checkinGateRepo = new ttts.repository.place.CheckinGate(redisClient);
// Cognitoからグループリストを取得して、入場ゲートリポジトリーに保管する
getCognitoGroups().then((groups) => __awaiter(this, void 0, void 0, function* () {
    const checkinGates = groups.map((group) => {
        return {
            identifier: group.GroupName,
            name: group.Description
        };
    });
    debug('storing checkinGates...', checkinGates);
    yield Promise.all(checkinGates.map((checkinGate) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield checkinGateRepo.store(checkinGate);
        }
        catch (error) {
            // tslint:disable-next-line:no-console
            console.error(error);
        }
    })));
})).catch((error) => {
    // tslint:disable-next-line:no-console
    console.error(error);
}).then(() => __awaiter(this, void 0, void 0, function* () {
    redisClient.quit();
}));
function getCognitoGroups() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
                apiVersion: 'latest',
                region: 'ap-northeast-1',
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            });
            cognitoIdentityServiceProvider.listGroups({
                UserPoolId: process.env.COGNITO_USER_POOL_ID
            }, (err, data) => {
                debug('listGroups result:', err, data);
                if (err instanceof Error) {
                    reject(err);
                }
                else {
                    if (data.Groups === undefined) {
                        reject(new Error('Unexpected.'));
                    }
                    else {
                        resolve(data.Groups);
                    }
                }
            });
        });
    });
}
