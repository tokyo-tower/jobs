/**
 * メールキュータスクコントローラー
 *
 * @namespace controller/emailQueue
 */

import { EmailQueueUtil, Models } from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';
import * as httpStatus from 'http-status';
import * as sendgrid from 'sendgrid';
import * as util from 'util';

const debug = createDebug('ttts-jobs:controller:emailQueue');

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
            const sg = sendgrid(<string>process.env.SENDGRID_API_KEY);
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
        await Models.EmailQueue.findByIdAndUpdate(emailQueue._id, { status: status }).exec();
        debug('cue saved');
    }
}
