/**
 * dbスキーマタスクコントローラー
 *
 * @namespace SchemaController
 */

import * as createDebug from 'debug';
import * as mongodb from 'mongodb';

const debug = createDebug('chevre-api:task:controller:schema');

/**
 * 全コレクションを削除する
 *
 * @memberOf SchemaController
 */
export function dropCollections() {
    mongodb.MongoClient.connect(process.env.MONGOLAB_URI, async (err, db) => {
        if (err !== null) throw err;

        const collections = await db.collections();
        await Promise.all(collections.map(async (collection) => {
            // 初めてコレクションを作成の場合、dropに失敗する
            try {
                debug('dropping collection...', collection.collectionName);
                await db.collection(collection.collectionName).drop();
                debug('collection dropped.', collection.collectionName);
            } catch (error) {
                debug('fain in dropping collection.', error);
            }
        }));
        debug('promised.');
        await db.close();
        process.exit(0);
    });
}

/**
 * インデックスをリセットする
 *
 * @memberOf SchemaController
 */
export function dropIndexes() {
    mongodb.MongoClient.connect(process.env.MONGOLAB_URI, async (err, db) => {
        if (err !== null) throw err;

        const collections = await db.collections();
        await Promise.all(collections.map(async (collection) => {
            debug('dropping index.', collection.collectionName);
            await db.collection(collection.collectionName).dropIndexes();
            debug('index droped.', collection.collectionName);
        }));
        debug('promised.');
        await db.close();
        process.exit(0);
    });
}
