"use strict";
/**
 * GMOタスクコントローラー
 *
 * @namespace GMOController
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
const log4js = require("log4js");
const moment = require("moment");
const mongoose = require("mongoose");
const MONGOLAB_URI = process.env.MONGOLAB_URI;
const MONGOLAB_URI_GMO = process.env.MONGOLAB_URI_GMO;
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
 * 通知を監視させる
 *
 * @memberOf GMOController
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
            yield processOne();
        }
        catch (error) {
            console.error(error);
        }
        count -= 1;
    }), INTERVAL_MILLISECONDS);
}
exports.watch = watch;
/**
 * GMO結果通知を処理する
 *
 * @memberOf GMOController
 */
// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
function processOne() {
    return __awaiter(this, void 0, void 0, function* () {
        logger.info('finding notification...');
        const db4gmo = mongoose.createConnection(MONGOLAB_URI_GMO);
        const gmoModel = db4gmo.model(chevre_domain_1.Models.GMONotification.modelName, chevre_domain_1.Models.GMONotification.schema);
        const notification = yield gmoModel.findOneAndUpdate({
            process_status: chevre_domain_1.GMONotificationUtil.PROCESS_STATUS_UNPROCESSED
        }, {
            $set: {
                process_status: chevre_domain_1.GMONotificationUtil.PROCESS_STATUS_PROCESSING
            }
        }, {
            new: true
        }).exec();
        logger.info('notification found.', notification);
        yield db4gmo.close();
        if (notification === null) {
            yield next(null, null);
            return;
        }
        // 内容の整合性チェック
        logger.info('finding reservations...payment_no:', notification.get('order_id'));
        try {
            const reservations = yield chevre_domain_1.Models.Reservation.find({
                payment_no: notification.get('order_id')
            }).exec();
            logger.info('reservations found.', reservations.length);
            if (reservations.length === 0) {
                yield next(null, notification);
                return;
            }
            // チェック文字列
            const shopPassString = gmo_service_1.Util.createShopPassString({
                shopId: notification.get('shop_id'),
                shopPass: process.env.GMO_SHOP_PASS,
                orderId: notification.get('order_id'),
                amount: notification.get('amount'),
                dateTime: moment(reservations[0].get('purchased_at')).format('YYYYMMDDHHmmss')
            });
            logger.info('shopPassString must be ', reservations[0].get('gmo_shop_pass_string'));
            if (shopPassString !== reservations[0].get('gmo_shop_pass_string')) {
                // 不正な結果通知なので、処理済みにする
                yield next(null, notification);
                return;
            }
            // クレジットカード決済の場合
            let rawUpdateReservation;
            if (notification.get('pay_type') === gmo_service_1.Util.PAY_TYPE_CREDIT) {
                switch (notification.get('status')) {
                    case gmo_service_1.Util.STATUS_CREDIT_CAPTURE:
                        // 予約完了ステータスへ変更
                        logger.info('updating reservations by paymentNo...', notification.get('order_id'));
                        rawUpdateReservation = yield chevre_domain_1.Models.Reservation.update({ payment_no: notification.get('order_id') }, {
                            gmo_shop_id: notification.get('shop_id'),
                            gmo_amount: notification.get('amount'),
                            gmo_tax: notification.get('tax'),
                            gmo_access_id: notification.get('access_id'),
                            gmo_forward: notification.get('forward'),
                            gmo_method: notification.get('method'),
                            gmo_approve: notification.get('approve'),
                            gmo_tran_id: notification.get('tran_id'),
                            gmo_tran_date: notification.get('tran_date'),
                            gmo_pay_type: notification.get('pay_type'),
                            gmo_status: notification.get('status'),
                            status: chevre_domain_1.ReservationUtil.STATUS_RESERVED,
                            updated_user: 'system'
                        }, { multi: true }).exec();
                        logger.info('reservations updated.', rawUpdateReservation);
                        // 完了メールキュー追加(あれば更新日時を更新するだけ)
                        logger.info('creating reservationEmailCue...');
                        yield chevre_domain_1.Models.ReservationEmailCue.findOneAndUpdate({
                            payment_no: notification.get('order_id'),
                            template: chevre_domain_1.ReservationEmailCueUtil.TEMPLATE_COMPLETE
                        }, {
                            $set: { updated_at: Date.now() },
                            $setOnInsert: { status: chevre_domain_1.ReservationEmailCueUtil.STATUS_UNSENT }
                        }, {
                            upsert: true,
                            new: true
                        }).exec();
                        logger.info('reservationEmailCue created.');
                        // あったにせよなかったにせよ処理済に
                        yield next(null, notification);
                        break;
                    case gmo_service_1.Util.STATUS_CREDIT_UNPROCESSED:
                        // 未決済の場合、放置
                        // ユーザーが「戻る」フローでキャンセルされる、あるいは、時間経過で空席になる
                        yield next(null, notification);
                        break;
                    case gmo_service_1.Util.STATUS_CREDIT_AUTHENTICATED:
                    case gmo_service_1.Util.STATUS_CREDIT_CHECK:
                        yield next(null, notification);
                        break;
                    case gmo_service_1.Util.STATUS_CREDIT_AUTH:
                        yield next(null, notification);
                        break;
                    case gmo_service_1.Util.STATUS_CREDIT_SALES:
                        yield next(null, notification);
                        break;
                    case gmo_service_1.Util.STATUS_CREDIT_VOID:
                        // 空席に戻さない(つくったけれども、連動しない方向で仕様決定)
                        yield next(null, notification);
                        break;
                    case gmo_service_1.Util.STATUS_CREDIT_RETURN:
                        yield next(null, notification);
                        break;
                    case gmo_service_1.Util.STATUS_CREDIT_RETURNX:
                        yield next(null, notification);
                        break;
                    case gmo_service_1.Util.STATUS_CREDIT_SAUTH:
                        yield next(null, notification);
                        break;
                    default:
                        yield next(null, notification);
                        break;
                }
            }
            else if (notification.get('pay_type') === gmo_service_1.Util.PAY_TYPE_CVS) {
                switch (notification.get('status')) {
                    case gmo_service_1.Util.STATUS_CVS_PAYSUCCESS:
                        // 予約完了ステータスへ変更
                        logger.info('updating reservations by paymentNo...', notification.get('order_id'));
                        rawUpdateReservation = yield chevre_domain_1.Models.Reservation.update({ payment_no: notification.get('order_id') }, {
                            status: chevre_domain_1.ReservationUtil.STATUS_RESERVED,
                            updated_user: 'system'
                        }, { multi: true }).exec();
                        logger.info('reservations updated.', rawUpdateReservation);
                        // 完了メールキュー追加(あれば更新日時を更新するだけ)
                        logger.info('creating reservationEmailCue...');
                        yield chevre_domain_1.Models.ReservationEmailCue.findOneAndUpdate({
                            payment_no: notification.get('order_id'),
                            template: chevre_domain_1.ReservationEmailCueUtil.TEMPLATE_COMPLETE
                        }, {
                            $set: { updated_at: Date.now() },
                            $setOnInsert: { status: chevre_domain_1.ReservationEmailCueUtil.STATUS_UNSENT }
                        }, {
                            upsert: true,
                            new: true
                        }).exec();
                        logger.info('reservationEmailCue created.');
                        // あったにせよなかったにせよ処理済に
                        yield next(null, notification);
                        break;
                    case gmo_service_1.Util.STATUS_CVS_REQSUCCESS:
                        // GMOパラメータを予約に追加
                        logger.info('updating reservations by paymentNo...', notification.get('order_id'));
                        rawUpdateReservation = yield chevre_domain_1.Models.Reservation.update({ payment_no: notification.get('order_id') }, {
                            gmo_shop_id: notification.get('shop_id'),
                            gmo_amount: notification.get('amount'),
                            gmo_tax: notification.get('tax'),
                            gmo_cvs_code: notification.get('cvs_code'),
                            gmo_cvs_conf_no: notification.get('cvs_conf_no'),
                            gmo_cvs_receipt_no: notification.get('cvs_receipt_no'),
                            gmo_payment_term: notification.get('payment_term'),
                            updated_user: 'system'
                        }, { multi: true }).exec();
                        logger.info('reservations updated.', rawUpdateReservation);
                        // 仮予約完了メールキュー追加(あれば更新日時を更新するだけ)
                        logger.info('creating reservationEmailCue...');
                        yield chevre_domain_1.Models.ReservationEmailCue.findOneAndUpdate({
                            payment_no: notification.get('order_id'),
                            template: chevre_domain_1.ReservationEmailCueUtil.TEMPLATE_TEMPORARY
                        }, {
                            $set: { updated_at: Date.now() },
                            $setOnInsert: { status: chevre_domain_1.ReservationEmailCueUtil.STATUS_UNSENT }
                        }, {
                            upsert: true,
                            new: true
                        }).exec();
                        logger.info('reservationEmailCue created.');
                        // あったにせよなかったにせよ処理済に
                        yield next(null, notification);
                        break;
                    case gmo_service_1.Util.STATUS_CVS_UNPROCESSED:
                        yield next(null, notification);
                        break;
                    case gmo_service_1.Util.STATUS_CVS_PAYFAIL: // 決済失敗
                    case gmo_service_1.Util.STATUS_CVS_CANCEL:
                        // 空席に戻す
                        logger.info('removing reservations...payment_no:', notification.get('order_id'));
                        const promises = reservations.map((reservation) => __awaiter(this, void 0, void 0, function* () {
                            logger.info('removing reservation...', reservation.get('_id'));
                            yield reservation.remove();
                            logger.info('reservation removed.', reservation.get('_id'));
                        }));
                        yield Promise.all(promises);
                        // processedフラグをたてる
                        yield next(null, notification);
                        break;
                    case gmo_service_1.Util.STATUS_CVS_EXPIRED:
                        // 内部で確保する仕様の場合
                        const staff = yield chevre_domain_1.Models.Staff.findOne({
                            user_id: '2016sagyo2'
                        }).exec();
                        logger.info('staff found.', staff);
                        logger.info('updating reservations...');
                        rawUpdateReservation = yield chevre_domain_1.Models.Reservation.update({
                            payment_no: notification.get('order_id')
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
                            // "purchased_at": Date.now(), // 購入日更新しない
                            watcher_name_updated_at: null,
                            watcher_name: ''
                        }, {
                            multi: true
                        }).exec();
                        logger.info('updated.', rawUpdateReservation);
                        yield next(null, notification);
                        break;
                    default:
                        yield next(null, notification);
                        break;
                }
            }
            else {
                // 他の決済は本案件では非対応
                yield next(null, notification);
                return;
            }
        }
        catch (error) {
            yield next(error, notification);
            return;
        }
    });
}
exports.processOne = processOne;
/**
 * プロセスを終了する
 *
 * @param {Object} notification
 *
 * @ignore
 */
function next(err, notification) {
    return __awaiter(this, void 0, void 0, function* () {
        if (notification === null)
            return;
        const status = (err instanceof Error) ? chevre_domain_1.GMONotificationUtil.PROCESS_STATUS_UNPROCESSED : chevre_domain_1.GMONotificationUtil.PROCESS_STATUS_PROCESSED;
        // processedフラグをたてる
        logger.info('setting process_status...', status);
        const db4gmo = mongoose.createConnection(MONGOLAB_URI_GMO);
        const gmoModel = db4gmo.model(chevre_domain_1.Models.GMONotification.modelName, chevre_domain_1.Models.GMONotification.schema);
        const result = yield gmoModel.findOneAndUpdate({
            _id: notification.get('_id')
        }, {
            $set: {
                process_status: status
            }
        }, {
            new: true
        }).exec();
        logger.info('notification saved.', result);
        yield db4gmo.close();
    });
}
