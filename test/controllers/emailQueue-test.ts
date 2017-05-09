/**
 * メールキューコントローラーテスト
 */

import * as TTTS from '@motionpicture/ttts-domain';
import * as assert from 'assert';
import * as mongoose from 'mongoose';

import * as emailQueueController from '../../app/controllers/emailQueue';

describe('メールキューコントローラー 送信', () => {
    let connection: mongoose.Connection;
    before(async () => {
        connection = mongoose.createConnection(process.env.MONGOLAB_URI);
        // 全削除
        const emailQueueModel = connection.model(TTTS.Models.EmailQueue.modelName, TTTS.Models.EmailQueue.schema);
        await emailQueueModel.remove({}).exec();
    });

    it('ok', async () => {
        const emailQueueModel = connection.model(TTTS.Models.EmailQueue.modelName, TTTS.Models.EmailQueue.schema);

        // テストデータ作成
        const emailQueue = {
            from: { // 送信者
                address: 'noreply@example.com',
                name: 'testfrom'
            },
            to: { // 送信先
                address: 'ilovegadd@gmail.com',
                name: 'testto'
            },
            subject: 'test subject',
            content: { // 本文
                mimetype: 'text/plain',
                text: 'test content'
            },
            status: TTTS.EmailQueueUtil.STATUS_UNSENT
        };

        const emailQueueDoc = await emailQueueModel.create(emailQueue);

        await emailQueueController.sendOne();

        // 送信済みになっていることを確認
        const sentEmailQueueDoc = await emailQueueModel.findById(emailQueueDoc._id).exec();
        assert.equal(sentEmailQueueDoc.get('status'), TTTS.EmailQueueUtil.STATUS_SENT);

        // テストデータ削除
        await emailQueueDoc.remove();
    });
});
