/**
 * グローバルヘルパー
 *
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';

before(async () => {
    ttts.mongoose.connect(<string>process.env.MONGOLAB_URI);
});
