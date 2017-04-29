// tslint:disable
// todo fix tslint
/**
 * 分析タスクコントローラー
 *
 * @namespace AnalysisController
 */

import { Models, ReservationUtil } from '@motionpicture/chevre-domain';
import { Util as GMOUtil } from '@motionpicture/gmo-service';

import * as createDebug from 'debug';
import * as fs from 'fs-extra';
import * as log4js from 'log4js';
import * as moment from 'moment';
import * as mongoose from 'mongoose';
import * as querystring from 'querystring';
import * as request from 'request';

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
export function checkArrayUnique(): void {
    fs.readFile(`${process.cwd()}/logs/${process.env.NODE_ENV}/paymentNos4sagyo2.json`, 'utf8', (err, data) => {
        if (err) throw err;

        let paymentNos: string[] = JSON.parse(data);
        debug(paymentNos.length.toString());

        // 配列から重複削除
        paymentNos = paymentNos.filter((element, index, self) => {
            return self.indexOf(element) === index;
        });

        debug(paymentNos.length.toString());
        process.exit(0);
    });
}

/**
 * GMO分の内部アカウント作業２へRESERVED
 * GMOでCAPTURE,PAYSUCCESS,REQSUCCESS出ないかどうか確認
 * DBでWAITING_SETTLEMENTかどうか確認
 *
 * @memberOf AnalysisController
 */
// tslint:disable-next-line:max-func-body-length
export function waiting2sagyo2(): void {
    mongoose.connect(MONGOLAB_URI);

    // tslint:disable-next-line:max-func-body-length
    fs.readFile(`${process.cwd()}/logs/${process.env.NODE_ENV}/paymentNos4sagyo2.json`, 'utf8', (err, data) => {
        if (err) throw err;

        const paymentNos: string[] = JSON.parse(data);
        const gmoUrl = (process.env.NODE_ENV === 'production') ? 'https://p01.mul-pay.jp/payment/SearchTradeMulti.idPass' : 'https://pt01.mul-pay.jp/payment/SearchTradeMulti.idPass';

        const promises = paymentNos.map((paymentNo) => {
            return new Promise((resolve, reject) => {
                // 取引状態参照
                logger.info('requesting... ');
                request.post(
                    {
                        url: gmoUrl,
                        form: {
                            ShopID: process.env.GMO_SHOP_ID,
                            ShopPass: process.env.GMO_SHOP_PASS,
                            OrderID: paymentNo,
                            PayType: GMOUtil.PAY_TYPE_CREDIT
                        }
                    },
                    (error, response, body) => {
                        logger.info('request processed.', error);
                        if (error) return reject(error);
                        if (response.statusCode !== STATUS_CODE_OK) return reject(new Error(`statusCode is ${response.statusCode}`));

                        const searchTradeResult = querystring.parse(body);

                        // クレジットカード決済情報がない場合コンビニ決済で検索
                        if (searchTradeResult.ErrCode) {
                            request.post(
                                {
                                    url: gmoUrl,
                                    form: {
                                        ShopID: process.env.GMO_SHOP_ID,
                                        ShopPass: process.env.GMO_SHOP_PASS,
                                        OrderID: paymentNo,
                                        PayType: GMOUtil.PAY_TYPE_CVS
                                    }
                                },
                                (errorOfSearchCVS, responseOfSearchCVS, bodyOfSearchCVS) => {
                                    if (errorOfSearchCVS) return reject(errorOfSearchCVS);
                                    if (responseOfSearchCVS.statusCode !== STATUS_CODE_OK) return reject(new Error(`statusCode is ${responseOfSearchCVS.statusCode}`));
                                    const searchTradeCVSResult = querystring.parse(bodyOfSearchCVS);
                                    if (searchTradeCVSResult.ErrCode) {
                                        // 情報なければOK
                                        resolve();
                                    } else {
                                        if (searchTradeCVSResult.Status === GMOUtil.STATUS_CVS_PAYSUCCESS || searchTradeCVSResult.Status === GMOUtil.STATUS_CVS_REQSUCCESS) {
                                            reject(new Error('searchTradeCVSResult.Status is PAYSUCCESS or REQSUCCESS'));
                                        } else {
                                            resolve();
                                        }
                                    }
                                }
                            );
                        } else {
                            if (searchTradeResult.Status === GMOUtil.STATUS_CREDIT_CAPTURE) {
                                reject(new Error('searchTradeResult.Status is CAPTURE'));
                            } else {
                                resolve();
                            }
                        }
                    }
                );
            });
        });

        Promise.all(promises).then(() => {
            debug(paymentNos.length.toString());

            // DBでWAITINGでないものがあるかどうかを確認
            const promisesOfCountWaitingReservations = paymentNos.map((paymentNo) => {
                return new Promise((resolve, reject) => {
                    logger.info('counting not in WAITING_SETTLEMENT, WAITING_SETTLEMENT_PAY_DESIGN');
                    Models.Reservation.count(
                        {
                            payment_no: paymentNo,
                            status: { $nin: [ReservationUtil.STATUS_WAITING_SETTLEMENT, ReservationUtil.STATUS_WAITING_SETTLEMENT_PAY_DESIGN] }
                            // status: {$nin: [ReservationUtil.STATUS_WAITING_SETTLEMENT]}
                        },
                        (countErr, countOfWaitingReservations) => {
                            logger.info('counted.', countErr, countOfWaitingReservations);
                            if (countErr) return reject(countErr);
                            (countOfWaitingReservations > 0) ? reject(new Error('status WAITING_SETTLEMENT exists.')) : resolve();
                        }
                    );
                });
            });

            Promise.all(promisesOfCountWaitingReservations).then(() => {
                debug(paymentNos.length.toString());
                logger.info('promised.');

                // 内部関係者で確保する
                Models.Staff.findOne(
                    {
                        user_id: '2016sagyo2'
                    },
                    (findStaffErr, staff) => {
                        logger.info('staff found.', findStaffErr, staff);
                        if (findStaffErr) {
                            mongoose.disconnect();
                            process.exit(0);
                            return;
                        }

                        logger.info('updating reservations...');
                        Models.Reservation.update(
                            {
                                payment_no: { $in: paymentNos }
                            },
                            {
                                status: ReservationUtil.STATUS_RESERVED,
                                purchaser_group: ReservationUtil.PURCHASER_GROUP_STAFF,

                                charge: 0,
                                ticket_type_charge: 0,
                                ticket_type_name_en: 'Free',
                                ticket_type_name_ja: '無料',
                                ticket_type_code: '00',

                                staff: staff.get('_id'),
                                staff_user_id: staff.get('user_id'),
                                staff_email: staff.get('email'),
                                staff_name: staff.get('name'),
                                staff_signature: 'system20161024', // 署名どうする？
                                updated_user: 'system',
                                // "purchased_at": Date.now(), // 購入日更新する？
                                watcher_name_updated_at: null,
                                watcher_name: ''
                            },
                            {
                                multi: true
                            },
                            (udpateReservationErr, raw) => {
                                logger.info('updated.', udpateReservationErr, raw);
                                debug(paymentNos.length.toString());
                                mongoose.disconnect();
                                process.exit(0);
                            }
                        );
                    }
                );
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

/**
 * コンビニ決済でwaitingのものを確定にする
 * GMOでPAYSUCCESSを確認
 * DBでWAITING_SETTLEMENTかどうか確認
 *
 * @memberOf AnalysisController
 */
export function cvsWaiting2reserved(): void {
    mongoose.connect(MONGOLAB_URI);

    fs.readFile(`${process.cwd()}/logs/${process.env.NODE_ENV}/paymentNos4cvsWaiting2reserved.json`, 'utf8', (err, data) => {
        logger.info('file read.', err);
        const paymentNos: string[] = JSON.parse(data);
        const gmoUrl = (process.env.NODE_ENV === 'production') ? 'https://p01.mul-pay.jp/payment/SearchTradeMulti.idPass' : 'https://pt01.mul-pay.jp/payment/SearchTradeMulti.idPass';

        const promises = paymentNos.map((paymentNo) => {
            return new Promise((resolve, reject) => {
                // 取引状態参照
                logger.info('requesting... ');
                request.post(
                    {
                        url: gmoUrl,
                        form: {
                            ShopID: process.env.GMO_SHOP_ID,
                            ShopPass: process.env.GMO_SHOP_PASS,
                            OrderID: paymentNo,
                            PayType: GMOUtil.PAY_TYPE_CVS
                        }
                    },
                    (error, response, body) => {
                        logger.info('request processed.', error);
                        if (error) return reject(error);
                        if (response.statusCode !== STATUS_CODE_OK) return reject(new Error(`statusCode is ${response.statusCode} ${paymentNo}`));

                        const searchTradeResult = querystring.parse(body);

                        if (searchTradeResult.ErrCode) {
                            reject(new Error(`ErrCode is ${searchTradeResult.ErrCode} ${paymentNo}`));
                        } else {
                            if (searchTradeResult.Status === GMOUtil.STATUS_CVS_PAYSUCCESS) {
                                resolve();
                            } else {
                                reject(new Error('searchTradeResult.Status is not PAYSUCCESS'));
                            }
                        }
                    }
                );
            });
        });

        Promise.all(promises).then(() => {
            debug(paymentNos.length.toString());

            logger.info('counting not in WAITING_SETTLEMENT');
            Models.Reservation.count(
                {
                    payment_no: { $in: paymentNos },
                    $or: [
                        {
                            status: { $nin: [ReservationUtil.STATUS_WAITING_SETTLEMENT] }
                        },
                        {
                            payment_method: { $nin: [GMOUtil.PAY_TYPE_CVS] }
                        }
                    ]
                },
                (countReservationErr, count) => {
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

                    Models.Reservation.update(
                        {
                            payment_no: { $in: paymentNos }
                        },
                        {
                            status: ReservationUtil.STATUS_RESERVED
                        },
                        {
                            multi: true
                        },
                        (updateReservationErr, raw) => {
                            logger.info('updated.', updateReservationErr, raw);
                            debug(paymentNos.length.toString());
                            mongoose.disconnect();
                            process.exit(0);
                        }
                    );
                }
            );
        }).catch((promiseErr) => {
            logger.error('promised.', promiseErr);
            mongoose.disconnect();
            process.exit(0);
        });
    });
}

/**
 * ペイデザイン決済でwaitingのものを確定にする
 * DBでWAITING_SETTLEMENT_PAY_DESIGNかどうか確認
 *
 * @memberOf AnalysisController
 */
export function payDesignWaiting2reserved(): void {
    mongoose.connect(MONGOLAB_URI);

    fs.readFile(`${process.cwd()}/logs/${process.env.NODE_ENV}/paymentNos4payDesignWaiting2reserved.json`, 'utf8', (err, data) => {
        logger.info('file read.', err);
        const paymentNos: string[] = JSON.parse(data);

        logger.info('counting not in WAITING_SETTLEMENT_PAY_DESIGN');
        Models.Reservation.count(
            {
                payment_no: { $in: paymentNos },
                $or: [
                    {
                        status: { $nin: [ReservationUtil.STATUS_WAITING_SETTLEMENT_PAY_DESIGN] }
                    },
                    {
                        payment_method: { $nin: [GMOUtil.PAY_TYPE_CVS] }
                    }
                ]
            },
            (countErr, count) => {
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

                Models.Reservation.update(
                    {
                        payment_no: { $in: paymentNos }
                    },
                    {
                        status: ReservationUtil.STATUS_RESERVED
                    },
                    {
                        multi: true
                    },
                    (updateReservationErr, raw) => {
                        logger.info('updated.', updateReservationErr, raw);
                        debug(paymentNos.length.toString());
                        mongoose.disconnect();
                        process.exit(0);
                    }
                );
            }
        );
    });
}

/**
 * GMOコンビニ決済キャンセルリストを内部作業用２確保に変更する
 *
 * @memberOf AnalysisController
 */
export function cvsCanceled2sagyo2(): void {
    mongoose.connect(MONGOLAB_URI);

    fs.readFile(`${process.cwd()}/logs/${process.env.NODE_ENV}/paymentNos4cvsCanceled2sagyo2.json`, 'utf8', (err, data) => {
        logger.info('file read.', err);
        if (err) {
            mongoose.disconnect();
            process.exit(0);
            return;
        }

        const paymentNos: string[] = JSON.parse(data);
        if (paymentNos.length === 0) {
            mongoose.disconnect();
            process.exit(0);
            return;
        }

        // 内部関係者で確保する
        Models.Staff.findOne(
            {
                user_id: '2016sagyo2'
            },
            (findStaffErr, staff) => {
                logger.info('staff found.', findStaffErr, staff);
                if (findStaffErr) {
                    mongoose.disconnect();
                    process.exit(0);
                    return;
                }

                logger.info('updating reservations...');
                Models.Reservation.update(
                    {
                        payment_no: { $in: paymentNos }
                    },
                    {
                        status: ReservationUtil.STATUS_RESERVED,
                        purchaser_group: ReservationUtil.PURCHASER_GROUP_STAFF,

                        charge: 0,
                        ticket_type_charge: 0,
                        ticket_type_name_en: 'Free',
                        ticket_type_name_ja: '無料',
                        ticket_type_code: '00',

                        staff: staff.get('_id'),
                        staff_user_id: staff.get('user_id'),
                        staff_email: staff.get('email'),
                        staff_name: staff.get('name'),
                        staff_signature: 'system', // 署名どうする？
                        updated_user: 'system',
                        // "purchased_at": Date.now(), // 購入日更新する？
                        watcher_name_updated_at: null,
                        watcher_name: ''
                    },
                    {
                        multi: true
                    },
                    (updateReservationErr, raw) => {
                        logger.info('updated.', updateReservationErr, raw);
                        debug(paymentNos.length.toString());
                        mongoose.disconnect();
                        process.exit(0);
                    }
                );
            }
        );
    });
}

/**
 * @memberOf AnalysisController
 */
export function createReservationsFromLogs(): void {
    fs.readFile(`${process.cwd()}/logs/gmoOrderIdsCVS.json`, 'utf8', (err, data) => {
        if (err) throw err;

        const paymentNos: string[] = JSON.parse(data);
        debug(paymentNos.length.toString());

        const promises = paymentNos.map((paymentNo) => {
            return new Promise((resolve, reject) => {
                fs.readFile(`${process.cwd()}/logs/reservationsGmoError/${paymentNo[paymentNo.length - 1]}/${paymentNo}.log`, 'utf8', (readFileErr, reservationLogData) => {
                    logger.info('log found', readFileErr);
                    if (readFileErr) return resolve();

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

/**
 * オーダーIDからGMO取消を行う
 *
 * @memberOf AnalysisController
 */
export function cancelGMO(): void {
    let options: any;
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
        if (error) return process.exit(0);
        if (response.statusCode !== STATUS_CODE_OK) return process.exit(0);
        const searchTradeResult = querystring.parse(body);
        if (searchTradeResult.ErrCode) return process.exit(0);
        if (searchTradeResult.Status !== GMOUtil.STATUS_CREDIT_CAPTURE) return process.exit(0); // 即時売上状態のみ先へ進める

        logger.info('searchTradeResult is ', searchTradeResult);

        // 決済変更
        options = {
            // url: 'https://pt01.mul-pay.jp/payment/AlterTran.idPass',
            form: {
                ShopID: process.env.GMO_SHOP_ID,
                ShopPass: process.env.GMO_SHOP_PASS,
                AccessID: searchTradeResult.AccessID,
                AccessPass: searchTradeResult.AccessPass,
                JobCd: GMOUtil.STATUS_CREDIT_VOID
            }
        };
        logger.info('requesting... options:', options);
        request.post('https://pt01.mul-pay.jp/payment/AlterTran.idPass', options, (errorOfAlterTran, responseOfAlterTran, bodyOfAlterTran) => {
            logger.info('request processed.', errorOfAlterTran, bodyOfAlterTran);
            if (errorOfAlterTran) return process.exit(0);
            if (responseOfAlterTran.statusCode !== STATUS_CODE_OK) return process.exit(0);
            const alterTranResult = querystring.parse(bodyOfAlterTran);
            if (alterTranResult.ErrCode) return process.exit(0);

            logger.info('alterTranResult is ', alterTranResult);

            process.exit(0);
        });
    });
}

/**
 *
 * @memberOf AnalysisController
 */
export function countReservations(): void {
    mongoose.connect(MONGOLAB_URI, {});
    Models.Reservation.find(
        {
            purchaser_group: { $in: [ReservationUtil.PURCHASER_GROUP_CUSTOMER, ReservationUtil.PURCHASER_GROUP_MEMBER] },
            // payment_no: "77000110810"
            status: ReservationUtil.STATUS_RESERVED,
            // status: ReservationUtil.STATUS_WAITING_SETTLEMENT,
            purchased_at: { $gt: moment('2016-10-20T12:00:00+9:00') }
        },
        'payment_no',
        (err, reservations) => {
            if (err) throw err;

            logger.info('reservations length is', reservations.length);
            const paymentNos: string[] = [];
            reservations.forEach((reservation) => {
                if (paymentNos.indexOf(reservation.get('payment_no')) < 0) {
                    paymentNos.push(reservation.get('payment_no'));
                }
            });
            logger.info('paymentNos.length is', paymentNos.length);
            mongoose.disconnect();
            process.exit(0);
        }
    );
}

/**
 * GMO取引状態を参照する
 *
 * @memberOf AnalysisController
 */
// tslint:disable-next-line:prefer-function-over-method
export function searchTrade(): void {
    const paymentNo = '92122101008';

    // 取引状態参照
    // logger.info('requesting...');
    request.post(
        {
            url: 'https://pt01.mul-pay.jp/payment/SearchTrade.idPass',
            form: {
                ShopID: process.env.GMO_SHOP_ID,
                ShopPass: process.env.GMO_SHOP_PASS,
                OrderID: paymentNo,
                PayType: GMOUtil.PAY_TYPE_CREDIT
            }
        },
        (error, response, body) => {
            // logger.info('request processed.', error, body);
            if (error) return process.exit(0);
            if (response.statusCode !== STATUS_CODE_OK) return process.exit(0);

            const searchTradeResult = querystring.parse(body);
            // logger.info('searchTradeResult is ', searchTradeResult);

            if (searchTradeResult.ErrCode) return process.exit(0);

            let statusStr = '';
            switch (searchTradeResult.Status) {
                case GMOUtil.STATUS_CVS_UNPROCESSED:
                    statusStr = '未決済';
                    break;

                case GMOUtil.STATUS_CVS_REQSUCCESS:
                    statusStr = '要求成功';
                    break;

                case GMOUtil.STATUS_CVS_PAYSUCCESS:
                    statusStr = '決済完了';
                    break;

                case GMOUtil.STATUS_CVS_PAYFAIL:
                    statusStr = '決済失敗';
                    break;

                case GMOUtil.STATUS_CVS_EXPIRED:
                    statusStr = '期限切れ';
                    break;

                case GMOUtil.STATUS_CVS_CANCEL:
                    statusStr = '支払い停止';
                    break;

                case GMOUtil.STATUS_CREDIT_CAPTURE:
                    statusStr = '即時売上';
                    break;

                case GMOUtil.STATUS_CREDIT_VOID:
                    statusStr = '取消';
                    break;

                default:
                    break;

            }

            debug(`${statusStr} \\${searchTradeResult.Amount}`);
            process.exit(0);
        }
    );
}
