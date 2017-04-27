"use strict";
/**
 * 予約メールタスクコントローラー
 *
 * @namespace ReservationEmailCueController
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
const chevre_domain_1 = require("@motionpicture/chevre-domain");
const gmo_service_1 = require("@motionpicture/gmo-service");
const createDebug = require("debug");
const conf = require("config");
const emailTemplates = require("email-templates");
const fs = require("fs-extra");
const moment = require("moment");
const mongoose = require("mongoose");
const numeral = require("numeral");
const qr = require("qr-image");
const sendgrid = require("sendgrid");
const MONGOLAB_URI = process.env.MONGOLAB_URI;
const debug = createDebug('chevre-jobs:controller:reservationEmailCue');
/**
 * キューを監視させる
 *
 * @memberOf ReservationEmailCueController
 */
function watch() {
    mongoose.connect(MONGOLAB_URI);
    let count = 0;
    const INTERVAL_MILLISECONDS = 500;
    const MAX_NUMBER_OF_PARALLEL_TASK = 10;
    setInterval(() => __awaiter(this, void 0, void 0, function* () {
        if (count > MAX_NUMBER_OF_PARALLEL_TASK)
            return;
        count += 1;
        try {
            yield sendOne();
        }
        catch (error) {
            console.error(error);
        }
        count -= 1;
    }), INTERVAL_MILLISECONDS);
}
exports.watch = watch;
/**
 * 予約完了メールを送信する
 *
 * @memberOf ReservationEmailCueController
 */
// tslint:disable-next-line:max-func-body-length
function sendOne() {
    return __awaiter(this, void 0, void 0, function* () {
        debug('finding reservationEmailCue...');
        const cue = yield chevre_domain_1.Models.ReservationEmailCue.findOneAndUpdate({
            status: chevre_domain_1.ReservationEmailCueUtil.STATUS_UNSENT
        }, {
            status: chevre_domain_1.ReservationEmailCueUtil.STATUS_SENDING
        }, { new: true }).exec();
        debug('reservationEmailCue found.', cue);
        if (cue === null) {
            yield next(null, cue);
            return;
        }
        let reservations;
        try {
            reservations = yield chevre_domain_1.Models.Reservation.find({
                payment_no: cue.get('payment_no')
            }).exec();
        }
        catch (error) {
            yield next(error, cue);
            return;
        }
        debug('reservations for email found.', reservations.length);
        if (reservations.length === 0) {
            yield next(null, cue);
            return;
        }
        let to = '';
        switch (reservations[0].get('purchaser_group')) {
            case chevre_domain_1.ReservationUtil.PURCHASER_GROUP_STAFF:
                to = reservations[0].get('staff_email');
                break;
            default:
                to = reservations[0].get('purchaser_email');
                break;
        }
        debug('to is', to);
        if (to.length === 0) {
            yield next(null, cue);
            return;
        }
        const EmailTemplate = emailTemplates.EmailTemplate;
        // __dirnameを使うとテンプレートを取得できないので注意
        // http://stackoverflow.com/questions/38173996/azure-and-node-js-dirname
        let dir;
        let titleJa;
        let titleEn;
        switch (cue.get('template')) {
            case chevre_domain_1.ReservationEmailCueUtil.TEMPLATE_COMPLETE:
                // 1.5次販売はメールテンプレート別
                if (reservations[0].get('pre_customer') !== undefined) {
                    dir = `${process.cwd()}/app/views/email/reserve/complete4preCustomer`;
                    titleJa = 'CHEVRE_EVENT_NAMEチケット 購入完了のお知らせ';
                    titleEn = 'Notice of Completion of CHEVRE Ticket Purchase';
                }
                else {
                    dir = `${process.cwd()}/app/views/email/reserve/complete`;
                    titleJa = 'CHEVRE_EVENT_NAMEチケット 購入完了のお知らせ';
                    titleEn = 'Notice of Completion of CHEVRE Ticket Purchase';
                }
                break;
            case chevre_domain_1.ReservationEmailCueUtil.TEMPLATE_TEMPORARY:
                // 1.5次販売はメールテンプレート別
                if (reservations[0].get('pre_customer') !== undefined) {
                    dir = `${process.cwd()}/app/views/email/reserve/waitingSettlement4preCustomer`;
                    titleJa = 'CHEVRE_EVENT_NAMEチケット 仮予約完了のお知らせ';
                    titleEn = 'Notice of Completion of Tentative Reservation for CHEVRE Tickets';
                }
                else {
                    dir = `${process.cwd()}/app/views/email/reserve/waitingSettlement`;
                    titleJa = 'CHEVRE_EVENT_NAMEチケット 仮予約完了のお知らせ';
                    titleEn = 'Notice of Completion of Tentative Reservation for CHEVRE Tickets';
                }
                break;
            default:
                yield next(new Error(`${cue.get('template')} not implemented.`), cue);
                return;
        }
        const template = new EmailTemplate(dir);
        const locals = {
            title_ja: titleJa,
            title_en: titleEn,
            reservations: reservations,
            moment: moment,
            numeral: numeral,
            conf: conf,
            GMOUtil: gmo_service_1.Util,
            ReservationUtil: chevre_domain_1.ReservationUtil
        };
        debug('rendering template...dir:', dir);
        template.render(locals, (renderErr, result) => __awaiter(this, void 0, void 0, function* () {
            debug('email template rendered.', renderErr);
            if (renderErr instanceof Error) {
                yield next(new Error('failed in rendering an email.'), cue);
                return;
            }
            const mail = new sendgrid.mail.Mail(new sendgrid.mail.Email(conf.get('email.from'), conf.get('email.fromname')), `[QRコード付き]${titleJa} [QR CODE TICKET]${titleEn}`, // TODO 成り行き上、仮完了にもQRコード付き、と入ってしまったので、直すこと
            new sendgrid.mail.Email(to), new sendgrid.mail.Content('text/html', result.html));
            // 完了の場合、QRコードを添付
            if (cue.get('template') === chevre_domain_1.ReservationEmailCueUtil.TEMPLATE_COMPLETE) {
                // add barcodes
                for (const reservation of reservations) {
                    const reservationId = reservation.get('_id').toString();
                    const attachment = new sendgrid.mail.Attachment();
                    attachment.setFilename(`QR_${reservationId}.png`);
                    attachment.setType('image/png');
                    attachment.setContent(qr.imageSync(reservation.get('qr_str'), { type: 'png' }).toString('base64'));
                    attachment.setDisposition('inline');
                    attachment.setContentId(`qrcode_${reservationId}`);
                    mail.addAttachment(attachment);
                }
            }
            // add logo
            const attachmentLogo = new sendgrid.mail.Attachment();
            attachmentLogo.setFilename('logo.png');
            attachmentLogo.setType('image/png');
            attachmentLogo.setContent(fs.readFileSync(`${__dirname}/../../../public/images/email/logo.png`).toString('base64'));
            attachmentLogo.setDisposition('inline');
            attachmentLogo.setContentId('logo');
            mail.addAttachment(attachmentLogo);
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
            try {
                const response = yield sg.API(request);
                debug('an email sent.', response);
                yield next(null, cue);
            }
            catch (error) {
                yield next(error, cue);
            }
        }));
    });
}
exports.sendOne = sendOne;
/**
 * メール送信トライ後の処理
 *
 * @param {Error} err
 * @param {mongoose.Document} cue
 * @param {log4js.Logger} localLogger
 *
 * @ignore
 */
function next(err, cue) {
    return __awaiter(this, void 0, void 0, function* () {
        if (cue === null)
            return;
        const status = (err instanceof Error) ? chevre_domain_1.ReservationEmailCueUtil.STATUS_UNSENT : chevre_domain_1.ReservationEmailCueUtil.STATUS_SENT;
        // 送信済みフラグを立てる
        debug('setting status...', status);
        cue.set('status', status);
        const res = yield cue.save();
        debug('cue saved.', res);
    });
}
