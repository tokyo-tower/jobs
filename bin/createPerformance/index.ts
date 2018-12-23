/**
 * create performances and reservations
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as performanceController from '../../controllers/performance';

import mongooseConnectionOptions from '../../mongooseConnectionOptions';

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

// tslint:disable-next-line:no-floating-promises
performanceController.createFromSetting()
    .catch((err) => {
        // tslint:disable-next-line:no-console
        console.error(err);
    }).then(() => {
        ttts.mongoose.disconnect();
    });
