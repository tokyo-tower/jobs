/**
 * create screens
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';
import * as screenController from '../../app/controllers/screen';

async function main(): Promise<void> {
    ttts.mongoose.connect(<string>process.env.MONGOLAB_URI);
    await screenController.createFromJson();
    ttts.mongoose.disconnect();
}

// tslint:disable-next-line:no-floating-promises
main().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error(err);
    process.exit(-1);
});
