/**
 * create reservations
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as StockController from '../../controllers/stock';

import mongooseConnectionOptions from '../../mongooseConnectionOptions';

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

// tslint:disable-next-line:no-floating-promises
StockController.createFromSetting()
    .catch((err) => {
        // tslint:disable-next-line:no-console
        console.error(err);
    }).then(() => {
        ttts.mongoose.disconnect();
    });
