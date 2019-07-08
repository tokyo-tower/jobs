/**
 * Chevreを使用しない場合のパフォーマンス作成
 */
import * as ttts from '@motionpicture/ttts-domain';
import * as performanceController from '../../controllers/performance';

import mongooseConnectionOptions from '../../mongooseConnectionOptions';

const USE_CHEVRE = process.env.USE_CHEVRE === '1';

if (!USE_CHEVRE) {
    ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions)
        .then()
        // tslint:disable-next-line:no-console
        .catch(console.error);

    // tslint:disable-next-line:no-floating-promises
    performanceController.createFromSetting()
        .catch((err) => {
            // tslint:disable-next-line:no-console
            console.error(err);
        }).then(async () => {
            await ttts.mongoose.disconnect();
        });
}
