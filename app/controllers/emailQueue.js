"use strict";
/**
 * メールキュータスクコントローラー
 *
 * @namespace controller/emailQueue
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
const ttts_domain_1 = require("@motionpicture/ttts-domain");
const createDebug = require("debug");
const httpStatus = require("http-status");
const sendgrid = require("sendgrid");
const util = require("util");
const debug = createDebug('ttts-jobs:controller:emailQueue');
/**
 * メールをひとつ送信する
 *
 * @memberOf controller/emailQueue
 */
function sendOne() {
    return __awaiter(this, void 0, void 0, function* () {
        let sendError = null;
        debug('finding emailQueue...');
        const emailQueue = yield ttts_domain_1.Models.EmailQueue.findOneAndUpdate({ status: ttts_domain_1.EmailQueueUtil.STATUS_UNSENT }, { status: ttts_domain_1.EmailQueueUtil.STATUS_SENDING }, { new: true }).exec();
        debug('emailQueue found.', emailQueue);
        if (emailQueue !== null) {
            try {
                const mail = new sendgrid.mail.Mail(new sendgrid.mail.Email(emailQueue.get('from.address'), emailQueue.get('from.name')), emailQueue.get('subject'), new sendgrid.mail.Email(emailQueue.get('to.address'), emailQueue.get('to.name')), new sendgrid.mail.Content(emailQueue.get('content.mimetype'), emailQueue.get('content.text')));
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
                const response = yield sg.API(request);
                debug('response is', response);
                // check the response.
                if (response.statusCode !== httpStatus.ACCEPTED) {
                    throw new Error(`sendgrid request not accepted. response is ${util.inspect(response)}`);
                }
            }
            catch (error) {
                sendError = error;
            }
            // 送信済みフラグを立てる
            const status = (sendError instanceof Error) ? ttts_domain_1.EmailQueueUtil.STATUS_UNSENT : ttts_domain_1.EmailQueueUtil.STATUS_SENT;
            debug('setting status...', status);
            yield ttts_domain_1.Models.EmailQueue.findByIdAndUpdate(emailQueue._id, { status: status }).exec();
            debug('cue saved');
        }
    });
}
exports.sendOne = sendOne;
