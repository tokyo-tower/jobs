"use strict";
/**
 * オーナータスクコントローラー
 *
 * @namespace controller/owner
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
const TTTS = require("@motionpicture/ttts-domain");
const crypto = require("crypto");
const createDebug = require("debug");
const fs = require("fs-extra");
const debug = createDebug('ttts-jobs:controller:staff');
/**
 *
 * @memberOf controller/owner
 */
function createFromJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const owners = fs.readJsonSync(`${process.cwd()}/data/${process.env.NODE_ENV}/owners.json`);
        // あれば更新、なければ追加
        yield Promise.all(owners.map((owner) => __awaiter(this, void 0, void 0, function* () {
            // パスワードハッシュ化
            const SIZE = 64;
            const passwordSalt = crypto.randomBytes(SIZE).toString('hex');
            owner.password_salt = passwordSalt;
            owner.password_hash = TTTS.CommonUtil.createHash(owner.password, passwordSalt);
            debug('updating owner...');
            yield TTTS.Models.Owner.findOneAndUpdate({
                username: owner.username
            }, owner, {
                new: true,
                upsert: true
            }).exec();
            debug('owner updated');
        })));
        debug('promised.');
    });
}
exports.createFromJson = createFromJson;
