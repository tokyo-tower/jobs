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
const createDebug = require("debug");
const fs = require("fs-extra");
const debug = createDebug('chevre-jobs:controller:window');
/**
 *
 * @memberOf WindowController
 */
function createFromJson() {
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
        debug('removing all windows...');
        chevre_domain_1.Models.Window.remove({}, (removeErr) => __awaiter(this, void 0, void 0, function* () {
            if (removeErr !== null) {
                throw removeErr;
            }
            debug('creating windows...');
            yield chevre_domain_1.Models.Window.create(windows);
            debug('windows created.');
        }));
    });
}
exports.createFromJson = createFromJson;
