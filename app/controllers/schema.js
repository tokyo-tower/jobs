"use strict";
/**
 * dbスキーマタスクコントローラー
 *
 * @namespace controller/schema
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
const ttts = require("@motionpicture/ttts-domain");
const createDebug = require("debug");
const debug = createDebug('ttts-jobs:controller:schema');
/**
 * 全コレクションを削除する
 *
 * @memberOf controller/schema
 */
function dropCollections() {
    return __awaiter(this, void 0, void 0, function* () {
        ttts.mongoose.connect(process.env.MONGOLAB_URI);
        const db = ttts.mongoose.connection.db;
        const collections = yield db.collections();
        yield Promise.all(collections.map((collection) => __awaiter(this, void 0, void 0, function* () {
            // 初めてコレクションを作成の場合、dropに失敗する
            try {
                debug('dropping collection...', collection.collectionName);
                yield db.collection(collection.collectionName).drop();
                debug('collection dropped.', collection.collectionName);
            }
            catch (error) {
                debug('fain in dropping collection.', error);
            }
        })));
        debug('promised.');
        yield db.close();
    });
}
exports.dropCollections = dropCollections;
