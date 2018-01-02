/**
 * マスターデータインポートジョブ
 * @ignore
 */

import * as ttts from '@motionpicture/ttts-domain';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';

import * as MasterSyncConstoller from '../../../../controllers/masterSync';

ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

async function main(): Promise<void> {
    await MasterSyncConstoller.createTicketTypesFromJson();
    await MasterSyncConstoller.createTicketTypeGroupsFromJson();
    await MasterSyncConstoller.createFilmsFromJson();
    await MasterSyncConstoller.createTheatersFromJson();
    await MasterSyncConstoller.createScreensFromJson();
    //await performanceController.createFromJson();

    await MasterSyncConstoller.createOwnersFromJson();
}

main().catch((err) => {
    console.error(err);
}).then(() => {
    ttts.mongoose.disconnect();
});
