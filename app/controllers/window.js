"use strict";
/**
 * 当日窓口アカウントタスクコントローラー
 *
 * @namespace WindowController
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
const crypto = require("crypto");
const fs = require("fs-extra");
const log4js = require("log4js");
const mongoose = require("mongoose");
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
 * @memberOf WindowController
 */
function createFromJson() {
    mongoose.connect(MONGOLAB_URI, {});
    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/windows.json`, 'utf8', (err, data) => {
        if (err instanceof Error) {
            throw err;
        }
        let windows = JSON.parse(data);
        // パスワードハッシュ化
        windows = windows.map((window) => {
            const SIZE = 64;
            const passwordSalt = crypto.randomBytes(SIZE).toString('hex');
            window.password_salt = passwordSalt;
            window.password_hash = chevre_domain_1.CommonUtil.createHash(window.password, passwordSalt);
            return window;
        });
        logger.info('removing all windows...');
        chevre_domain_1.Models.Window.remove({}, (removeErr) => __awaiter(this, void 0, void 0, function* () {
            if (removeErr !== null) {
                throw removeErr;
            }
            logger.debug('creating windows...');
            yield chevre_domain_1.Models.Window.create(windows);
            logger.info('windows created.');
            mongoose.disconnect();
            process.exit(0);
        }));
    });
}
exports.createFromJson = createFromJson;
