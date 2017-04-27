/**
 * 予約メールタスクコントローラー
 *
 * @namespace ReservationEmailCueController
 */

import { Models, ReservationEmailCueUtil, ReservationUtil } from '@motionpicture/chevre-domain';
import { Util as GMOUtil } from '@motionpicture/gmo-service';
import * as createDebug from 'debug';

import * as conf from 'config';
import * as emailTemplates from 'email-templates';
import * as fs from 'fs-extra';
import * as moment from 'moment';
import * as mongoose from 'mongoose';
import * as numeral from 'numeral';
import * as qr from 'qr-image';
import * as sendgrid from 'sendgrid';

const MONGOLAB_URI = process.env.MONGOLAB_URI;
const debug = createDebug('chevre-jobs:controller:reservationEmailCue');

/**
 * キューを監視させる
 *
 * @memberOf ReservationEmailCueController
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
 * 予約完了メールを送信する
 *
 * @memberOf ReservationEmailCueController
 */
// tslint:disable-next-line:max-func-body-length
export async function sendOne() {
    debug('finding reservationEmailCue...');
    const cue = await Models.ReservationEmailCue.findOneAndUpdate(
        {
            status: ReservationEmailCueUtil.STATUS_UNSENT
        },
        {
            status: ReservationEmailCueUtil.STATUS_SENDING
        },
        { new: true }
    ).exec();

    debug('reservationEmailCue found.', cue);
    if (cue === null) {
        await next(null, cue);
        return;
    }

    let reservations: mongoose.Document[];
    try {
        reservations = await Models.Reservation.find(
            {
                payment_no: cue.get('payment_no')
            }
        ).exec();
    } catch (error) {
        await next(error, cue);
        return;
    }

    debug('reservations for email found.', reservations.length);
    if (reservations.length === 0) {
        await next(null, cue);
        return;
    }

    let to = '';
    switch (reservations[0].get('purchaser_group')) {
        case ReservationUtil.PURCHASER_GROUP_STAFF:
            to = reservations[0].get('staff_email');
            break;

        default:
            to = reservations[0].get('purchaser_email');
            break;
    }

    debug('to is', to);
    if (to.length === 0) {
        await next(null, cue);
        return;
    }

    const EmailTemplate = emailTemplates.EmailTemplate;
    // __dirnameを使うとテンプレートを取得できないので注意
    // http://stackoverflow.com/questions/38173996/azure-and-node-js-dirname
    let dir: string;
    let titleJa: string;
    let titleEn: string;
    switch (cue.get('template')) {
        case ReservationEmailCueUtil.TEMPLATE_COMPLETE:
            // 1.5次販売はメールテンプレート別
            if (reservations[0].get('pre_customer') !== undefined) {
                dir = `${process.cwd()}/app/views/email/reserve/complete4preCustomer`;
                titleJa = 'CHEVRE_EVENT_NAMEチケット 購入完了のお知らせ';
                titleEn = 'Notice of Completion of CHEVRE Ticket Purchase';
            } else {
                dir = `${process.cwd()}/app/views/email/reserve/complete`;
                titleJa = 'CHEVRE_EVENT_NAMEチケット 購入完了のお知らせ';
                titleEn = 'Notice of Completion of CHEVRE Ticket Purchase';
            }

            break;
        case ReservationEmailCueUtil.TEMPLATE_TEMPORARY:
            // 1.5次販売はメールテンプレート別
            if (reservations[0].get('pre_customer') !== undefined) {
                dir = `${process.cwd()}/app/views/email/reserve/waitingSettlement4preCustomer`;
                titleJa = 'CHEVRE_EVENT_NAMEチケット 仮予約完了のお知らせ';
                titleEn = 'Notice of Completion of Tentative Reservation for CHEVRE Tickets';
            } else {
                dir = `${process.cwd()}/app/views/email/reserve/waitingSettlement`;
                titleJa = 'CHEVRE_EVENT_NAMEチケット 仮予約完了のお知らせ';
                titleEn = 'Notice of Completion of Tentative Reservation for CHEVRE Tickets';
            }

            break;
        default:
            await next(new Error(`${cue.get('template')} not implemented.`), cue);
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
        GMOUtil: GMOUtil,
        ReservationUtil: ReservationUtil
    };

    debug('rendering template...dir:', dir);
    template.render(locals, async (renderErr, result) => {
        debug('email template rendered.', renderErr);
        if (renderErr instanceof Error) {
            await next(new Error('failed in rendering an email.'), cue);
            return;
        }

        const mail = new sendgrid.mail.Mail(
            new sendgrid.mail.Email(conf.get<string>('email.from'), conf.get<string>('email.fromname')),
            `[QRコード付き]${titleJa} [QR CODE TICKET]${titleEn}`, // TODO 成り行き上、仮完了にもQRコード付き、と入ってしまったので、直すこと
            new sendgrid.mail.Email(to),
            new sendgrid.mail.Content('text/html', result.html)
        );

        // 完了の場合、QRコードを添付
        if (cue.get('template') === ReservationEmailCueUtil.TEMPLATE_COMPLETE) {
            // add barcodes
            for (const reservation of reservations) {
                const reservationId = reservation.get('_id').toString();

                const attachment = new sendgrid.mail.Attachment();
                attachment.setFilename(`QR_${reservationId}.png`);
                attachment.setType('image/png');
                attachment.setContent((<Buffer>qr.imageSync(reservation.get('qr_str'), { type: 'png' })).toString('base64'));
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
            const response = await sg.API(request);
            debug('an email sent.', response);
            await next(null, cue);
        } catch (error) {
            await next(error, cue);
        }
    });
}

/**
 * メール送信トライ後の処理
 *
 * @param {Error} err
 * @param {mongoose.Document} cue
 * @param {log4js.Logger} localLogger
 *
 * @ignore
 */
async function next(err: Error | null, cue: mongoose.Document | null) {
    if (cue === null) return;

    const status = (err instanceof Error) ? ReservationEmailCueUtil.STATUS_UNSENT : ReservationEmailCueUtil.STATUS_SENT;

    // 送信済みフラグを立てる
    debug('setting status...', status);
    cue.set('status', status);
    const res = await cue.save();
    debug('cue saved.', res);
}
