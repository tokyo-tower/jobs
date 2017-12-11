/**
 * パフォーマンス在庫状況を更新する
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';

import * as performanceController from '../../../../app/controllers/performance';
import mongooseConnectionOptions from '../../../../app/mongooseConnectionOptions';

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

performanceController.updateStatuses()
    .then(() => {
        // no op
    }).catch((err) => {
        console.error(err);
    }).then(() => {
        ttts.mongoose.disconnect();
        process.exit(0);
    });
