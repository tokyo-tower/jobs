"use strict";
/**
 * メールキューコントローラーテスト
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
const assert = require("assert");
const emailQueueController = require("../../app/controllers/emailQueue");
describe('メールキューコントローラー 送信', () => {
    let connection;
    before(() => __awaiter(this, void 0, void 0, function* () {
        connection = ttts.mongoose.createConnection(process.env.MONGOLAB_URI);
        // 全削除
        const emailQueueModel = connection.model(ttts.Models.EmailQueue.modelName, ttts.Models.EmailQueue.schema);
        yield emailQueueModel.remove({}).exec();
    }));
    it('ok', () => __awaiter(this, void 0, void 0, function* () {
        const emailQueueModel = connection.model(ttts.Models.EmailQueue.modelName, ttts.Models.EmailQueue.schema);
        // テストデータ作成
        const emailQueue = {
            from: {
                address: 'noreply@example.com',
                name: 'testfrom'
            },
            to: {
                address: 'ilovegadd@gmail.com',
                name: 'testto'
            },
            subject: 'test subject',
            content: {
                mimetype: 'text/plain',
                text: 'test content'
            },
            status: ttts.EmailQueueUtil.STATUS_UNSENT
        };
        const emailQueueDoc = yield emailQueueModel.create(emailQueue);
        yield emailQueueController.sendOne();
        // 送信済みになっていることを確認
        const sentEmailQueueDoc = yield emailQueueModel.findById(emailQueueDoc._id).exec();
        if (sentEmailQueueDoc !== null) {
            assert.equal(sentEmailQueueDoc.get('status'), ttts.EmailQueueUtil.STATUS_SENT);
        }
        // テストデータ削除
        yield emailQueueDoc.remove();
    }));
});
