"use strict";
/**
 * マスターデータインポートジョブ
 * @ignore
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ttts = require("@motionpicture/ttts-domain");
const mongooseConnectionOptions_1 = require("../../../../mongooseConnectionOptions");
const MasterSyncConstoller = require("../../../../controllers/masterSync");
ttts.mongoose.connect(process.env.MONGOLAB_URI, mongooseConnectionOptions_1.default);
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield MasterSyncConstoller.createTicketTypesFromJson();
        yield MasterSyncConstoller.createTicketTypeGroupsFromJson();
        yield MasterSyncConstoller.createFilmsFromJson();
        yield MasterSyncConstoller.createTheatersFromJson();
        yield MasterSyncConstoller.createScreensFromJson();
        //await performanceController.createFromJson();
    });
}
main().catch((err) => {
    console.error(err);
}).then(() => {
    ttts.mongoose.disconnect();
});
