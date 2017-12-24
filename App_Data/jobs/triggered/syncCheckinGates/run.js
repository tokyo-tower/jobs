"use strict";
/**
 * 入場ゲート情報を、所有者リポジトリーから同期する
 * @ignore
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ttts = require("@motionpicture/ttts-domain");
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
const redisClient = ttts.redis.createClient({
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(process.env.REDIS_PORT, 10),
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});
const ownerRepo = new ttts.repository.Owner(ttts.mongoose.connection);
const checkinGateRepo = new ttts.repository.place.CheckinGate(redisClient);
ownerRepo.ownerModel.find({ notes: '1' })
    .exec().then((owners) => __awaiter(this, void 0, void 0, function* () {
    const checkinGates = owners.map((owner) => {
        return {
            identifier: owner.get('group'),
            name: owner.get('description')
        };
    });
    yield Promise.all(checkinGates.map((checkinGate) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield checkinGateRepo.store(checkinGate);
        }
        catch (error) {
            console.error(error);
        }
    })));
})).catch((error) => {
    console.error(error);
}).then(() => {
    ttts.mongoose.disconnect();
    redisClient.quit();
});
