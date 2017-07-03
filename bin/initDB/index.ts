/**
 * mongodbのデータを初期化する
 * 主に開発環境構築時に使用することを想定しています
 *
 * @ignore
 */

import * as mongoose from 'mongoose';

import * as clientController from '../../app/controllers/client';
import * as filmController from '../../app/controllers/film';
import * as ownerController from '../../app/controllers/owner';
import * as performanceController from '../../app/controllers/performance';
import * as schemaController from '../../app/controllers/schema';
// import * as staffController from '../../app/controllers/staff';
import * as theaterController from '../../app/controllers/theater';
import * as ticketTypeController from '../../app/controllers/ticketType';
import * as ticketTypeGroupController from '../../app/controllers/ticketTypeGroup';

async function main(): Promise<void> {
    mongoose.connect(process.env.MONGOLAB_URI);

    await schemaController.dropCollections();
    await ticketTypeController.createFromJson();
    await ticketTypeGroupController.createFromJson();
    await filmController.createFromJson();
    await theaterController.createFromJson();
    await theaterController.createScreensFromJson();
    //await performanceController.createFromJson();

    await clientController.createFromJson();
    await ownerController.createFromJson();

    // 時間がかかってしまうので、一時的にコメントアウト
    // await staffController.createReservationsFromJson();
    // await memberController.createReservationsFromJson();

    mongoose.disconnect();
}

// tslint:disable-next-line:no-floating-promises
main().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error(err);
});
