"use strict";
// tslint:disable
// todo fix tslint
/**
 * テストタスクコントローラー
 *
 * @namespace TestController
 */
Object.defineProperty(exports, "__esModule", { value: true });
const chevre_domain_1 = require("@motionpicture/chevre-domain");
const conf = require("config");
const createDebug = require("debug");
const fs = require("fs-extra");
const log4js = require("log4js");
const moment = require("moment");
const mongodb = require("mongodb");
const mongoose = require("mongoose");
const querystring = require("querystring");
const request = require("request");
const debug = createDebug('chevre-api:task:controller:test');
const MONGOLAB_URI = process.env.MONGOLAB_URI;
// todo ログ出力方法考える
log4js.configure({
    appenders: [
        {
            category: 'system',
            type: 'console'
        }
    ],
    levels: {
        system: 'ALL'
    },
    replaceConsole: true
});
const logger = log4js.getLogger('system');
/**
 *
 * @memberOf TestController
 */
function checkFullWidthLetter() {
    const filmName = '作家性の萌芽　1999-2003 （細田守監督短編集）『劇場版デジモンアドベンチャー』『劇場版デジモンアドベンチャー　ぼくらのウォーゲーム！』『村上隆作品　SUPERFLAT MONOGRAM』『村上隆作品　The Creatures From Planet 66 ～Roppongi Hills Story～』『おジャ魔女どれみドッカ～ン！（40話）』『明日のナージャ（OP、ED）』';
    const filmNameFullWidth = chevre_domain_1.CommonUtil.toFullWidth(filmName);
    let registerDisp1 = '';
    // tslint:disable-next-line:prefer-for-of no-increment-decrement
    for (let i = 0; i < filmNameFullWidth.length; i++) {
        const letter = filmNameFullWidth[i];
        if (letter.match(/[Ａ-Ｚａ-ｚ０-９]/)
            || letter.match(/[\u3040-\u309F]/) // ひらがな
            || letter.match(/[\u30A0-\u30FF]/) // カタカナ
            || letter.match(/[一-龠]/) // 漢字
        ) {
            registerDisp1 += letter;
        }
    }
    logger.debug(registerDisp1);
    process.exit(0);
}
exports.checkFullWidthLetter = checkFullWidthLetter;
/**
 *
 * @memberOf TestController
 */
function listIndexes() {
    mongodb.MongoClient.connect(process.env.MONGOLAB_URI, (err, db) => {
        debug(err);
        const collectionNames = [
            'authentications',
            'customer_cancel_requests',
            'films',
            'members',
            'performances',
            'pre_customers',
            'reservation_email_cues',
            'reservations',
            'screens',
            'sequences',
            'sponsors',
            'staffs',
            'tel_staffs',
            'theaters',
            'ticket_type_groups',
            'windows'
        ];
        const promises = collectionNames.map((collectionName) => {
            return new Promise((resolve, reject) => {
                db.collection(collectionName).indexInformation((indexInfoErr, info) => {
                    if (indexInfoErr)
                        return reject();
                    debug(collectionName, 'indexInformation is', info);
                    resolve();
                });
            });
        });
        Promise.all(promises).then(() => {
            logger.info('promised.');
            db.close();
            process.exit(0);
        }, (paromiseErr) => {
            logger.error('promised.', paromiseErr);
            db.close();
            process.exit(0);
        });
    });
}
exports.listIndexes = listIndexes;
/**
 *
 * @memberOf TestController
 */
function testCreateConnection() {
    const uri = 'mongodb://dev4gmotiffmlabmongodbuser:Yrpx-rPjr_Qjx79_R4HaknsfMEbyrQjp4NiF-XKj@ds048719.mlab.com:48719/dev4gmotiffmlabmongodb';
    mongoose.connect(MONGOLAB_URI, {});
    chevre_domain_1.Models.Reservation.count({}, (err, count) => {
        logger.info('count', err, count);
        const db4gmo = mongoose.createConnection(uri);
        db4gmo.collection('reservations').count({}, (err2, count2) => {
            logger.info('count', err2, count2);
            db4gmo.close();
            chevre_domain_1.Models.Reservation.count({}, (err3, count3) => {
                logger.info('count', err3, count3);
                mongoose.disconnect();
                process.exit(0);
            });
        });
    });
}
exports.testCreateConnection = testCreateConnection;
/**
 * メール配信された購入番号リストを取得する
 *
 * @memberOf TestController
 */
// tslint:disable-next-line:prefer-function-over-method
function getPaymentNosWithEmail() {
    mongoose.connect(MONGOLAB_URI);
    chevre_domain_1.Models.GMONotification.distinct('order_id', {
        // status:{$in:["CAPTURE","PAYSUCCESS"]},
        status: { $in: ['PAYSUCCESS'] },
        processed: true
    }, (err, orderIds) => {
        debug('orderIds length is ', err, orderIds.length);
        const file = `${__dirname}/../../../../logs/${process.env.NODE_ENV}/orderIds.txt`;
        debug(file);
        fs.writeFileSync(file, orderIds.join('\n'), 'utf8');
        mongoose.disconnect();
        process.exit(0);
    });
    // fs.readFile(`${process.cwd()}/logs/${process.env.NODE_ENV}/orderIds.json`, 'utf8', (err, data) => {
    //     debug(err);
    //     let orderIds: Array<string> = JSON.parse(data);
    //     debug('orderIds length is ', orderIds.length);
    //     mongoose.connect(MONGOLAB_URI);
    //     logger.info('finding...');
    //     Models.ReservationEmailCue.distinct('payment_no', {
    //         is_sent: true,
    //         payment_no: {$in: orderIds}
    //     }, (err, paymentNos) => {
    //         debug('paymentNos length is ', paymentNos.length);
    //         let file = `${__dirname}/../../../../logs/${process.env.NODE_ENV}/paymentNos.txt`;
    //         debug(file);
    //         fs.writeFileSync(file, paymentNos.join("\n"), 'utf8');
    //         mongoose.disconnect();
    //         process.exit(0);
    //     });
    // });
}
exports.getPaymentNosWithEmail = getPaymentNosWithEmail;
/**
 *
 * @memberOf TestController
 */
function createEmailCues() {
    fs.readFile(`${__dirname}/../../../../logs/${process.env.NODE_ENV}/20161021_orderIds4reemail.json`, 'utf8', (err, data) => {
        const orderIds = JSON.parse(data);
        debug('orderIds length is ', orderIds.length, err);
        const cues = orderIds.map((orderId) => {
            return {
                payment_no: orderId,
                is_sent: false
            };
        });
        mongoose.connect(MONGOLAB_URI);
        logger.info('creating ReservationEmailCues...length:', cues.length);
        chevre_domain_1.Models.ReservationEmailCue.insertMany(cues, (insertErr) => {
            logger.info('ReservationEmailCues created.', insertErr);
            mongoose.disconnect();
            process.exit(0);
        });
    });
}
exports.createEmailCues = createEmailCues;
/**
 * 座席解放
 *
 * @memberOf TestController
 */
// tslint:disable-next-line:prefer-function-over-method
function release() {
    mongoose.connect(MONGOLAB_URI);
    chevre_domain_1.Models.Reservation.count({
        status: chevre_domain_1.ReservationUtil.STATUS_KEPT_BY_CHEVRE
    }, (err, count) => {
        debug(err, count);
        // Models.Reservation.remove({
        //     status: ReservationUtil.STATUS_KEPT_BY_CHEVRE
        // }, (err) => {
        //     debug(err);
        mongoose.disconnect();
        process.exit(0);
        // });
    });
}
exports.release = release;
/**
 *
 * @memberOf TestController
 */
function gmoNotificationProcessing2unprocess() {
    mongoose.connect(MONGOLAB_URI);
    logger.info('updating GMONotification...');
    chevre_domain_1.Models.GMONotification.update({
        process_status: 'PROCESSING',
        updated_at: {
            $lt: moment().add(-1, 'hour').toISOString()
        }
    }, {
        process_status: 'UNPROCESSED'
    }, {
        multi: true
    }, (err, raw) => {
        logger.info('GMONotification updated.', err, raw);
        mongoose.disconnect();
        process.exit(0);
    });
}
exports.gmoNotificationProcessing2unprocess = gmoNotificationProcessing2unprocess;
/**
 *
 * @memberOf TestController
 */
function getBounces() {
    const query = querystring.stringify({
        api_user: conf.get('sendgrid_username'),
        api_key: conf.get('sendgrid_password'),
        date: '1'
        // start_date: "2016-10-18",
        // end_date: "2016-10-19"
    });
    request.get({
        url: `https://api.sendgrid.com/api/bounces.get.json?${query}`
        // url: `https://api.sendgrid.com/api/blocks.get.json?${query}`
        // url: `https://api.sendgrid.com/api/invalidemails.get.json?${query}`
        // url: `https://api.sendgrid.com/api/spamreports.get.json?${query}`
    }, (error, response, body) => {
        logger.info('request processed.', error, response, body);
        process.exit(0);
    });
}
exports.getBounces = getBounces;
