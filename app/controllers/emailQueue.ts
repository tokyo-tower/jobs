/**
 * メールキュータスクコントローラー
 *
 * @namespace controller/emailQueue
 */

import { EmailQueueUtil, Models } from '@motionpicture/chevre-domain';
import * as createDebug from 'debug';
import * as httpStatus from 'http-status';
import * as mongoose from 'mongoose';
import * as sendgrid from 'sendgrid';
import * as util from 'util';

const MONGOLAB_URI = process.env.MONGOLAB_URI;
const debug = createDebug('chevre-jobs:controller:emailQueue');

/**
 * キューを監視させる
 *
 * @memberOf controller/emailQueue
 */
export function watch(): void {
    mongoose.connect(MONGOLAB_URI);
    let count = 0;

    const INTERVAL_MILLISECONDS = 500;
    const MAX_NUMBER_OF_PARALLEL_TASK = 10;
    setInterval(
        async () => {
            if (count > MAX_NUMBER_OF_PARALLEL_TASK) return;

            count += 1;

            try {
                await sendOne();
            } catch (error) {
                console.error(error);
            }

            count -= 1;
        },
        INTERVAL_MILLISECONDS
    );
}

/**
 * メールをひとつ送信する
 *
 * @memberOf controller/emailQueue
 */
export async function sendOne() {
    let sendError: Error | null = null;
    debug('finding emailQueue...');
    const emailQueue = await Models.EmailQueue.findOneAndUpdate(
        { status: EmailQueueUtil.STATUS_UNSENT },
        { status: EmailQueueUtil.STATUS_SENDING },
        { new: true }
    ).exec();

    debug('emailQueue found.', emailQueue);
    if (emailQueue !== null) {
        try {
            const mail = new sendgrid.mail.Mail(
                new sendgrid.mail.Email(emailQueue.get('from.address'), emailQueue.get('from.name')),
                emailQueue.get('subject'),
                new sendgrid.mail.Email(emailQueue.get('to.address'), emailQueue.get('to.name')),
                new sendgrid.mail.Content(emailQueue.get('content.mimetype'), emailQueue.get('content.text'))
            );

            // todo customargs追加(DBの情報と連携させるため)

            debug('sending an email...email:', mail);
            const sg = sendgrid(process.env.SENDGRID_API_KEY);
            const request = sg.emptyRequest({
                host: 'api.sendgrid.com',
                method: 'POST',
                path: '/v3/mail/send',
                headers: {},
                body: mail.toJSON(),
                queryParams: {},
                test: false,
                port: ''
            });

            debug('requesting sendgrid api...', request);
            const response = await sg.API(request);
            debug('response is', response);

            // check the response.
            if (response.statusCode !== httpStatus.ACCEPTED) {
                throw new Error(`sendgrid request not accepted. response is ${util.inspect(response)}`);
            }
        } catch (error) {
            sendError = error;
        }

        // 送信済みフラグを立てる
        const status = (sendError instanceof Error) ? EmailQueueUtil.STATUS_UNSENT : EmailQueueUtil.STATUS_SENT;
        debug('setting status...', status);
        emailQueue.set('status', status);
        const res = await emailQueue.save();
        debug('cue saved.', res);
    }
}
