/**
 * グローバルヘルパー
 *
 * @ignore
 */

import * as mongoose from 'mongoose';

before(async () => {
    (<any>mongoose).Promise = global.Promise;
    mongoose.connect(process.env.MONGOLAB_URI);
});
