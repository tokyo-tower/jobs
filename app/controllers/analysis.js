"use strict";
// tslint:disable
// todo fix tslint
/**
 * 分析タスクコントローラー
 *
 * @namespace AnalysisController
 */
Object.defineProperty(exports, "__esModule", { value: true });
const chevre_domain_1 = require("@motionpicture/chevre-domain");
const gmo_service_1 = require("@motionpicture/gmo-service");
const createDebug = require("debug");
const fs = require("fs-extra");
const log4js = require("log4js");
const moment = require("moment");
const mongoose = require("mongoose");
const querystring = require("querystring");
const request = require("request");
const debug = createDebug('chevre-api:task:controller:analysis');
const MONGOLAB_URI = process.env.MONGOLAB_URI;
const STATUS_CODE_OK = 200;
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
 * @memberOf AnalysisController
 */
// tslint:disable-next-line:prefer-function-over-method
function checkArrayUnique() {
    fs.readFile(`${process.cwd()}/logs/${process.env.NODE_ENV}/paymentNos4sagyo2.json`, 'utf8', (err, data) => {
        if (err)
            throw err;
        let paymentNos = JSON.parse(data);
        debug(paymentNos.length.toString());
        // 配列から重複削除
        paymentNos = paymentNos.filter((element, index, self) => {
            return self.indexOf(element) === index;
        });
        debug(paymentNos.length.toString());
        process.exit(0);
    });
}
exports.checkArrayUnique = checkArrayUnique;
/**
 * GMO分の内部アカウント作業２へRESERVED
 * GMOでCAPTURE,PAYSUCCESS,REQSUCCESS出ないかどうか確認
 * DBでWAITING_SETTLEMENTかどうか確認
 *
 * @memberOf AnalysisController
 */
// tslint:disable-next-line:max-func-body-length
function waiting2sagyo2() {
    mongoose.connect(MONGOLAB_URI);
    // tslint:disable-next-line:max-func-body-length
    fs.readFile(`${process.cwd()}/logs/${process.env.NODE_ENV}/paymentNos4sagyo2.json`, 'utf8', (err, data) => {
        if (err)
            throw err;
        const paymentNos = JSON.parse(data);
        const gmoUrl = (process.env.NODE_ENV === 'production') ? 'https://p01.mul-pay.jp/payment/SearchTradeMulti.idPass' : 'https://pt01.mul-pay.jp/payment/SearchTradeMulti.idPass';
        const promises = paymentNos.map((paymentNo) => {
            return new Promise((resolve, reject) => {
                // 取引状態参照
                logger.info('requesting... ');
                request.post({
                    url: gmoUrl,
                    form: {
                        ShopID: process.env.GMO_SHOP_ID,
                        ShopPass: process.env.GMO_SHOP_PASS,
                        OrderID: paymentNo,
                        PayType: gmo_service_1.Util.PAY_TYPE_CREDIT
                    }
                }, (error, response, body) => {
                    logger.info('request processed.', error);
                    if (error)
                        return reject(error);
                    if (response.statusCode !== STATUS_CODE_OK)
                        return reject(new Error(`statusCode is ${response.statusCode}`));
                    const searchTradeResult = querystring.parse(body);
                    // クレジットカード決済情報がない場合コンビニ決済で検索
                    if (searchTradeResult.ErrCode) {
                        request.post({
                            url: gmoUrl,
                            form: {
                                ShopID: process.env.GMO_SHOP_ID,
                                ShopPass: process.env.GMO_SHOP_PASS,
                                OrderID: paymentNo,
                                PayType: gmo_service_1.Util.PAY_TYPE_CVS
                            }
                        }, (errorOfSearchCVS, responseOfSearchCVS, bodyOfSearchCVS) => {
                            if (errorOfSearchCVS)
                                return reject(errorOfSearchCVS);
                            if (responseOfSearchCVS.statusCode !== STATUS_CODE_OK)
                                return reject(new Error(`statusCode is ${responseOfSearchCVS.statusCode}`));
                            const searchTradeCVSResult = querystring.parse(bodyOfSearchCVS);
                            if (searchTradeCVSResult.ErrCode) {
                                // 情報なければOK
                                resolve();
                            }
                            else {
                                if (searchTradeCVSResult.Status === gmo_service_1.Util.STATUS_CVS_PAYSUCCESS || searchTradeCVSResult.Status === gmo_service_1.Util.STATUS_CVS_REQSUCCESS) {
                                    reject(new Error('searchTradeCVSResult.Status is PAYSUCCESS or REQSUCCESS'));
                                }
                                else {
                                    resolve();
                                }
                            }
                        });
                    }
                    else {
                        if (searchTradeResult.Status === gmo_service_1.Util.STATUS_CREDIT_CAPTURE) {
                            reject(new Error('searchTradeResult.Status is CAPTURE'));
                        }
                        else {
                            resolve();
                        }
                    }
                });
            });
        });
        Promise.all(promises).then(() => {
            debug(paymentNos.length.toString());
            // DBでWAITINGでないものがあるかどうかを確認
            const promisesOfCountWaitingReservations = paymentNos.map((paymentNo) => {
                return new Promise((resolve, reject) => {
                    logger.info('counting not in WAITING_SETTLEMENT, WAITING_SETTLEMENT_PAY_DESIGN');
                    chevre_domain_1.Models.Reservation.count({
                        payment_no: paymentNo,
                        status: { $nin: [chevre_domain_1.ReservationUtil.STATUS_WAITING_SETTLEMENT, chevre_domain_1.ReservationUtil.STATUS_WAITING_SETTLEMENT_PAY_DESIGN] }
                        // status: {$nin: [ReservationUtil.STATUS_WAITING_SETTLEMENT]}
                    }, (countErr, countOfWaitingReservations) => {
                        logger.info('counted.', countErr, countOfWaitingReservations);
                        if (countErr)
                            return reject(countErr);
                        (countOfWaitingReservations > 0) ? reject(new Error('status WAITING_SETTLEMENT exists.')) : resolve();
                    });
                });
            });
            Promise.all(promisesOfCountWaitingReservations).then(() => {
                debug(paymentNos.length.toString());
                logger.info('promised.');
                // 内部関係者で確保する
                chevre_domain_1.Models.Staff.findOne({
                    user_id: '2016sagyo2'
                }, (findStaffErr, staff) => {
                    logger.info('staff found.', findStaffErr, staff);
                    if (findStaffErr) {
                        mongoose.disconnect();
                        process.exit(0);
                        return;
                    }
                    logger.info('updating reservations...');
                    chevre_domain_1.Models.Reservation.update({
                        payment_no: { $in: paymentNos }
                    }, {
                        status: chevre_domain_1.ReservationUtil.STATUS_RESERVED,
                        purchaser_group: chevre_domain_1.ReservationUtil.PURCHASER_GROUP_STAFF,
                        charge: 0,
                        ticket_type_charge: 0,
                        ticket_type_name_en: 'Free',
                        ticket_type_name_ja: '無料',
                        ticket_type_code: '00',
                        staff: staff.get('_id'),
                        staff_user_id: staff.get('user_id'),
                        staff_email: staff.get('email'),
                        staff_name: staff.get('name'),
                        staff_signature: 'system20161024',
                        updated_user: 'system',
                        // "purchased_at": Date.now(), // 購入日更新する？
                        watcher_name_updated_at: null,
                        watcher_name: ''
                    }, {
                        multi: true
                    }, (udpateReservationErr, raw) => {
                        logger.info('updated.', udpateReservationErr, raw);
                        debug(paymentNos.length.toString());
                        mongoose.disconnect();
                        process.exit(0);
                    });
                });
            }).catch((promiseErr) => {
                logger.error('promised.', promiseErr);
                mongoose.disconnect();
                process.exit(0);
            });
        }).catch((promiseErr) => {
            logger.error('promised.', promiseErr);
            mongoose.disconnect();
            process.exit(0);
        });
    });
}
exports.waiting2sagyo2 = waiting2sagyo2;
/**
 * コンビニ決済でwaitingのものを確定にする
 * GMOでPAYSUCCESSを確認
 * DBでWAITING_SETTLEMENTかどうか確認
 *
 * @memberOf AnalysisController
 */
function cvsWaiting2reserved() {
    mongoose.connect(MONGOLAB_URI);
    fs.readFile(`${process.cwd()}/logs/${process.env.NODE_ENV}/paymentNos4cvsWaiting2reserved.json`, 'utf8', (err, data) => {
        logger.info('file read.', err);
        const paymentNos = JSON.parse(data);
        const gmoUrl = (process.env.NODE_ENV === 'production') ? 'https://p01.mul-pay.jp/payment/SearchTradeMulti.idPass' : 'https://pt01.mul-pay.jp/payment/SearchTradeMulti.idPass';
        const promises = paymentNos.map((paymentNo) => {
            return new Promise((resolve, reject) => {
                // 取引状態参照
                logger.info('requesting... ');
                request.post({
                    url: gmoUrl,
                    form: {
                        ShopID: process.env.GMO_SHOP_ID,
                        ShopPass: process.env.GMO_SHOP_PASS,
                        OrderID: paymentNo,
                        PayType: gmo_service_1.Util.PAY_TYPE_CVS
                    }
                }, (error, response, body) => {
                    logger.info('request processed.', error);
                    if (error)
                        return reject(error);
                    if (response.statusCode !== STATUS_CODE_OK)
                        return reject(new Error(`statusCode is ${response.statusCode} ${paymentNo}`));
                    const searchTradeResult = querystring.parse(body);
                    if (searchTradeResult.ErrCode) {
                        reject(new Error(`ErrCode is ${searchTradeResult.ErrCode} ${paymentNo}`));
                    }
                    else {
                        if (searchTradeResult.Status === gmo_service_1.Util.STATUS_CVS_PAYSUCCESS) {
                            resolve();
                        }
                        else {
                            reject(new Error('searchTradeResult.Status is not PAYSUCCESS'));
                        }
                    }
                });
            });
        });
        Promise.all(promises).then(() => {
            debug(paymentNos.length.toString());
            logger.info('counting not in WAITING_SETTLEMENT');
            chevre_domain_1.Models.Reservation.count({
                payment_no: { $in: paymentNos },
                $or: [
                    {
                        status: { $nin: [chevre_domain_1.ReservationUtil.STATUS_WAITING_SETTLEMENT] }
                    },
                    {
                        payment_method: { $nin: [gmo_service_1.Util.PAY_TYPE_CVS] }
                    }
                ]
            }, (countReservationErr, count) => {
                logger.info('counted.', countReservationErr, count);
                if (countReservationErr) {
                    mongoose.disconnect();
                    process.exit(0);
                    return;
                }
                if (count > 0) {
                    mongoose.disconnect();
                    process.exit(0);
                    return;
                }
                chevre_domain_1.Models.Reservation.update({
                    payment_no: { $in: paymentNos }
                }, {
                    status: chevre_domain_1.ReservationUtil.STATUS_RESERVED
                }, {
                    multi: true
                }, (updateReservationErr, raw) => {
                    logger.info('updated.', updateReservationErr, raw);
                    debug(paymentNos.length.toString());
                    mongoose.disconnect();
                    process.exit(0);
                });
            });
        }).catch((promiseErr) => {
            logger.error('promised.', promiseErr);
            mongoose.disconnect();
            process.exit(0);
        });
    });
}
exports.cvsWaiting2reserved = cvsWaiting2reserved;
/**
 * ペイデザイン決済でwaitingのものを確定にする
 * DBでWAITING_SETTLEMENT_PAY_DESIGNかどうか確認
 *
 * @memberOf AnalysisController
 */
function payDesignWaiting2reserved() {
    mongoose.connect(MONGOLAB_URI);
    fs.readFile(`${process.cwd()}/logs/${process.env.NODE_ENV}/paymentNos4payDesignWaiting2reserved.json`, 'utf8', (err, data) => {
        logger.info('file read.', err);
        const paymentNos = JSON.parse(data);
        logger.info('counting not in WAITING_SETTLEMENT_PAY_DESIGN');
        chevre_domain_1.Models.Reservation.count({
            payment_no: { $in: paymentNos },
            $or: [
                {
                    status: { $nin: [chevre_domain_1.ReservationUtil.STATUS_WAITING_SETTLEMENT_PAY_DESIGN] }
                },
                {
                    payment_method: { $nin: [gmo_service_1.Util.PAY_TYPE_CVS] }
                }
            ]
        }, (countErr, count) => {
            logger.info('counted.', countErr, count);
            if (countErr) {
                mongoose.disconnect();
                process.exit(0);
                return;
            }
            if (count > 0) {
                mongoose.disconnect();
                process.exit(0);
                return;
            }
            chevre_domain_1.Models.Reservation.update({
                payment_no: { $in: paymentNos }
            }, {
                status: chevre_domain_1.ReservationUtil.STATUS_RESERVED
            }, {
                multi: true
            }, (updateReservationErr, raw) => {
                logger.info('updated.', updateReservationErr, raw);
                debug(paymentNos.length.toString());
                mongoose.disconnect();
                process.exit(0);
            });
        });
    });
}
exports.payDesignWaiting2reserved = payDesignWaiting2reserved;
/**
 * GMOコンビニ決済キャンセルリストを内部作業用２確保に変更する
 *
 * @memberOf AnalysisController
 */
function cvsCanceled2sagyo2() {
    mongoose.connect(MONGOLAB_URI);
    fs.readFile(`${process.cwd()}/logs/${process.env.NODE_ENV}/paymentNos4cvsCanceled2sagyo2.json`, 'utf8', (err, data) => {
        logger.info('file read.', err);
        if (err) {
            mongoose.disconnect();
            process.exit(0);
            return;
        }
        const paymentNos = JSON.parse(data);
        if (paymentNos.length === 0) {
            mongoose.disconnect();
            process.exit(0);
            return;
        }
        // 内部関係者で確保する
        chevre_domain_1.Models.Staff.findOne({
            user_id: '2016sagyo2'
        }, (findStaffErr, staff) => {
            logger.info('staff found.', findStaffErr, staff);
            if (findStaffErr) {
                mongoose.disconnect();
                process.exit(0);
                return;
            }
            logger.info('updating reservations...');
            chevre_domain_1.Models.Reservation.update({
                payment_no: { $in: paymentNos }
            }, {
                status: chevre_domain_1.ReservationUtil.STATUS_RESERVED,
                purchaser_group: chevre_domain_1.ReservationUtil.PURCHASER_GROUP_STAFF,
                charge: 0,
                ticket_type_charge: 0,
                ticket_type_name_en: 'Free',
                ticket_type_name_ja: '無料',
                ticket_type_code: '00',
                staff: staff.get('_id'),
                staff_user_id: staff.get('user_id'),
                staff_email: staff.get('email'),
                staff_name: staff.get('name'),
                staff_signature: 'system',
                updated_user: 'system',
                // "purchased_at": Date.now(), // 購入日更新する？
                watcher_name_updated_at: null,
                watcher_name: ''
            }, {
                multi: true
            }, (updateReservationErr, raw) => {
                logger.info('updated.', updateReservationErr, raw);
                debug(paymentNos.length.toString());
                mongoose.disconnect();
                process.exit(0);
            });
        });
    });
}
exports.cvsCanceled2sagyo2 = cvsCanceled2sagyo2;
/**
 * @memberOf AnalysisController
 */
function createReservationsFromLogs() {
    fs.readFile(`${process.cwd()}/logs/gmoOrderIdsCVS.json`, 'utf8', (err, data) => {
        if (err)
            throw err;
        const paymentNos = JSON.parse(data);
        debug(paymentNos.length.toString());
        const promises = paymentNos.map((paymentNo) => {
            return new Promise((resolve, reject) => {
                fs.readFile(`${process.cwd()}/logs/reservationsGmoError/${paymentNo[paymentNo.length - 1]}/${paymentNo}.log`, 'utf8', (readFileErr, reservationLogData) => {
                    logger.info('log found', readFileErr);
                    if (readFileErr)
                        return resolve();
                    // let pattern = /\[(.+)] \[INFO] reservation - updating reservation all infos...update: { _id: '(.+)',\n  status: '(.+)',\n  seat_code: '(.+)',\n  seat_grade_name_ja: '(.+)',\n  seat_grade_name_en: '(.+)',\n  seat_grade_additional_charge: (.+),\n  ticket_type_code: '(.+)',\n  ticket_type_name_ja: '(.+)',\n  ticket_type_name_en: '(.+)',\n  ticket_type_charge: (.+),\n  charge: (.+),\n  payment_no: '(.+)',\n  purchaser_group: '(.+)',\n  performance: '(.+)',\n/;
                    const pattern = /reservation - updating reservation all infos...update: {[^}]+}/g;
                    const matches = reservationLogData.match(pattern);
                    let json = '[\n';
                    if (matches) {
                        matches.forEach((match, index) => {
                            json += (index > 0) ? ',\n' : '';
                            const reservation = match.replace('reservation - updating reservation all infos...update: ', '')
                                .replace(/"/g, '\\"')
                                .replace(/ _id:/g, '"_id":')
                                .replace(/[ ]{2}([a-z_]+[a-z0-9_]+):/g, '"$1":')
                                .replace(/: '/g, ': "')
                                .replace(/',/g, '",')
                                .replace(/\\'/g, '\'');
                            json += reservation;
                        });
                    }
                    json += '\n]';
                    logger.info('writing json...');
                    // fs.writeFile(`${process.cwd()}/logs/${process.env.NODE_ENV}/jsonsFromGmoOrderIdsCredit/${paymentNo}.json`, json, 'utf8', (err) => {
                    fs.writeFile(`${process.cwd()}/logs/${process.env.NODE_ENV}/jsonsFromGmoOrderIdsCVS/${paymentNo}.json`, json, 'utf8', (writeFileErr) => {
                        logger.info('json written', writeFileErr);
                        (writeFileErr) ? reject(writeFileErr) : resolve();
                    });
                });
            });
        });
        Promise.all(promises).then(() => {
            logger.info('promised.');
            process.exit(0);
        }).catch((promiseErr) => {
            logger.error('promised.', promiseErr);
            process.exit(0);
        });
    });
}
exports.createReservationsFromLogs = createReservationsFromLogs;
/**
 * オーダーIDからGMO取消を行う
 *
 * @memberOf AnalysisController
 */
function cancelGMO() {
    let options;
    const paymentNo = '50000001412';
    // 取引状態参照
    options = {
        // url: 'https://pt01.mul-pay.jp/payment/SearchTrade.idPass',
        form: {
            ShopID: process.env.GMO_SHOP_ID,
            ShopPass: process.env.GMO_SHOP_PASS,
            OrderID: paymentNo
        }
    };
    logger.info('requesting... options:', options);
    request.post('https://pt01.mul-pay.jp/payment/SearchTrade.idPass', options, (error, response, body) => {
        logger.info('request processed.', error, body);
        if (error)
            return process.exit(0);
        if (response.statusCode !== STATUS_CODE_OK)
            return process.exit(0);
        const searchTradeResult = querystring.parse(body);
        if (searchTradeResult.ErrCode)
            return process.exit(0);
        if (searchTradeResult.Status !== gmo_service_1.Util.STATUS_CREDIT_CAPTURE)
            return process.exit(0); // 即時売上状態のみ先へ進める
        logger.info('searchTradeResult is ', searchTradeResult);
        // 決済変更
        options = {
            // url: 'https://pt01.mul-pay.jp/payment/AlterTran.idPass',
            form: {
                ShopID: process.env.GMO_SHOP_ID,
                ShopPass: process.env.GMO_SHOP_PASS,
                AccessID: searchTradeResult.AccessID,
                AccessPass: searchTradeResult.AccessPass,
                JobCd: gmo_service_1.Util.STATUS_CREDIT_VOID
            }
        };
        logger.info('requesting... options:', options);
        request.post('https://pt01.mul-pay.jp/payment/AlterTran.idPass', options, (errorOfAlterTran, responseOfAlterTran, bodyOfAlterTran) => {
            logger.info('request processed.', errorOfAlterTran, bodyOfAlterTran);
            if (errorOfAlterTran)
                return process.exit(0);
            if (responseOfAlterTran.statusCode !== STATUS_CODE_OK)
                return process.exit(0);
            const alterTranResult = querystring.parse(bodyOfAlterTran);
            if (alterTranResult.ErrCode)
                return process.exit(0);
            logger.info('alterTranResult is ', alterTranResult);
            process.exit(0);
        });
    });
}
exports.cancelGMO = cancelGMO;
/**
 *
 * @memberOf AnalysisController
 */
function countReservations() {
    mongoose.connect(MONGOLAB_URI, {});
    chevre_domain_1.Models.Reservation.find({
        purchaser_group: { $in: [chevre_domain_1.ReservationUtil.PURCHASER_GROUP_CUSTOMER, chevre_domain_1.ReservationUtil.PURCHASER_GROUP_MEMBER] },
        // payment_no: "77000110810"
        status: chevre_domain_1.ReservationUtil.STATUS_RESERVED,
        // status: ReservationUtil.STATUS_WAITING_SETTLEMENT,
        purchased_at: { $gt: moment('2016-10-20T12:00:00+9:00') }
    }, 'payment_no', (err, reservations) => {
        if (err)
            throw err;
        logger.info('reservations length is', reservations.length);
        const paymentNos = [];
        reservations.forEach((reservation) => {
            if (paymentNos.indexOf(reservation.get('payment_no')) < 0) {
                paymentNos.push(reservation.get('payment_no'));
            }
        });
        logger.info('paymentNos.length is', paymentNos.length);
        mongoose.disconnect();
        process.exit(0);
    });
}
exports.countReservations = countReservations;
/**
 *
 * @memberOf AnalysisController
 */
function countReservationCues() {
    mongoose.connect(MONGOLAB_URI, {});
    chevre_domain_1.Models.ReservationEmailCue.count({
        is_sent: false
    }, (err, count) => {
        if (err)
            throw err;
        logger.info('count is', count);
        mongoose.disconnect();
        process.exit(0);
    });
}
exports.countReservationCues = countReservationCues;
/**
 * メール配信された購入番号リストを取得する
 *
 * @memberOf AnalysisController
 */
// tslint:disable-next-line:prefer-function-over-method
function getPaymentNosWithEmail() {
    mongoose.connect(MONGOLAB_URI);
    chevre_domain_1.Models.GMONotification.distinct('order_id', {
        // status:{$in:["CAPTURE","PAYSUCCESS"]},
        status: { $in: ['PAYSUCCESS'] },
        processed: true
    }, (err, orderIds) => {
        if (err)
            throw err;
        debug('orderIds length is ', orderIds.length);
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
 * @memberOf AnalysisController
 */
function createEmailCues() {
    fs.readFile(`${__dirname}/../../../../logs/${process.env.NODE_ENV}/20161021_orderIds4reemail.json`, 'utf8', (err, data) => {
        if (err)
            throw err;
        const orderIds = JSON.parse(data);
        debug('orderIds length is ', orderIds.length);
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
 * GMO取引状態を参照する
 *
 * @memberOf AnalysisController
 */
// tslint:disable-next-line:prefer-function-over-method
function searchTrade() {
    const paymentNo = '92122101008';
    // 取引状態参照
    // logger.info('requesting...');
    request.post({
        url: 'https://pt01.mul-pay.jp/payment/SearchTrade.idPass',
        form: {
            ShopID: process.env.GMO_SHOP_ID,
            ShopPass: process.env.GMO_SHOP_PASS,
            OrderID: paymentNo,
            PayType: gmo_service_1.Util.PAY_TYPE_CREDIT
        }
    }, (error, response, body) => {
        // logger.info('request processed.', error, body);
        if (error)
            return process.exit(0);
        if (response.statusCode !== STATUS_CODE_OK)
            return process.exit(0);
        const searchTradeResult = querystring.parse(body);
        // logger.info('searchTradeResult is ', searchTradeResult);
        if (searchTradeResult.ErrCode)
            return process.exit(0);
        let statusStr = '';
        switch (searchTradeResult.Status) {
            case gmo_service_1.Util.STATUS_CVS_UNPROCESSED:
                statusStr = '未決済';
                break;
            case gmo_service_1.Util.STATUS_CVS_REQSUCCESS:
                statusStr = '要求成功';
                break;
            case gmo_service_1.Util.STATUS_CVS_PAYSUCCESS:
                statusStr = '決済完了';
                break;
            case gmo_service_1.Util.STATUS_CVS_PAYFAIL:
                statusStr = '決済失敗';
                break;
            case gmo_service_1.Util.STATUS_CVS_EXPIRED:
                statusStr = '期限切れ';
                break;
            case gmo_service_1.Util.STATUS_CVS_CANCEL:
                statusStr = '支払い停止';
                break;
            case gmo_service_1.Util.STATUS_CREDIT_CAPTURE:
                statusStr = '即時売上';
                break;
            case gmo_service_1.Util.STATUS_CREDIT_VOID:
                statusStr = '取消';
                break;
            default:
                break;
        }
        debug(`${statusStr} \\${searchTradeResult.Amount}`);
        process.exit(0);
    });
}
exports.searchTrade = searchTrade;
