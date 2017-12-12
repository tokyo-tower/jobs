/**
 * dbスキーマタスクコントローラー
 *
 * @namespace controller/schema
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as createDebug from 'debug';

const debug = createDebug('ttts-jobs:controller:schema');

/**
 * 全コレクションを削除する
 *
 * @memberOf controller/schema
 */
export async function dropCollections() {
    ttts.mongoose.connect(<string>process.env.MONGOLAB_URI);
    const db = ttts.mongoose.connection.db;
    const collections = await db.collections();
    await Promise.all(collections.map(async (collection: any) => {
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
