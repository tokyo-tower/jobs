"use strict";
/**
 * dbスキーマタスクコントローラー
 *
 * @namespace SchemaController
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
const createDebug = require("debug");
const mongodb = require("mongodb");
const debug = createDebug('chevre-api:task:controller:schema');
/**
 * 全コレクションを削除する
 *
 * @memberOf SchemaController
 */
function dropCollections() {
    mongodb.MongoClient.connect(process.env.MONGOLAB_URI, (err, db) => __awaiter(this, void 0, void 0, function* () {
        if (err !== null) {
            throw err;
        }
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
        process.exit(0);
    }));
}
exports.dropCollections = dropCollections;
/**
 * インデックスをリセットする
 *
 * @memberOf SchemaController
 */
function dropIndexes() {
    mongodb.MongoClient.connect(process.env.MONGOLAB_URI, (err, db) => __awaiter(this, void 0, void 0, function* () {
        if (err !== null) {
            throw err;
        }
        const collections = yield db.collections();
        yield Promise.all(collections.map((collection) => __awaiter(this, void 0, void 0, function* () {
            debug('dropping index.', collection.collectionName);
            yield db.collection(collection.collectionName).dropIndexes();
            debug('index droped.', collection.collectionName);
        })));
        debug('promised.');
        yield db.close();
        process.exit(0);
    }));
}
exports.dropIndexes = dropIndexes;
