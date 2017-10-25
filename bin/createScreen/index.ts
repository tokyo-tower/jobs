/**
 * create screens
 *
 * @ignore
 */
import * as mongoose from 'mongoose';
import * as screenController from '../../app/controllers/screen';

async function main(): Promise<void> {
    mongoose.connect(process.env.MONGOLAB_URI);
    await screenController.createFromJson();
    mongoose.disconnect();
}

// tslint:disable-next-line:no-floating-promises
main().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error(err);
    process.exit(-1);
});
