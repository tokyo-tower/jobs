/**
 * グローバルヘルパー
 *
 * @ignore
 */

import * as mongoose from 'mongoose';

before(async () => {
    mongoose.connect(process.env.MONGOLAB_URI);
});
