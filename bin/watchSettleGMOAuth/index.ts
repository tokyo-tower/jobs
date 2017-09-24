/**
 * task name
 *
 * @ignore
 */

import * as mongoose from 'mongoose';
import * as gmoController from '../../app/controllers/gmo';

mongoose.connect(process.env.MONGOLAB_URI);
let count = 0;

const INTERVAL_MILLISECONDS = 250;
const MAX_NUMBER_OF_PARALLEL_TASK = 10;
setInterval(
    async () => {
        if (count > MAX_NUMBER_OF_PARALLEL_TASK) {
            return;
        }

        count += 1;

        try {
            await gmoController.settleGMOAuth();
        } catch (error) {
            console.error(error);
        }

        count -= 1;
    },
    INTERVAL_MILLISECONDS
);
