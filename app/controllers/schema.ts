/**
 * dbスキーマタスクコントローラー
 *
 * @namespace controller/schema
 */

import * as createDebug from 'debug';
import * as mongodb from 'mongodb';

const debug = createDebug('chevre-jobs:controller:schema');

/**
 * 全コレクションを削除する
 *
 * @memberOf controller/schema
 */
export async function dropCollections() {
    const db = await mongodb.MongoClient.connect(process.env.MONGOLAB_URI);
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
}
