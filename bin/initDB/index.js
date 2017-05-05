"use strict";
/**
 * mongodbのデータを初期化する
 * 主に開発環境構築時に使用することを想定しています
 *
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
const mongoose = require("mongoose");
const filmController = require("../../app/controllers/film");
const memberController = require("../../app/controllers/member");
const performanceController = require("../../app/controllers/performance");
const schemaController = require("../../app/controllers/schema");
const staffController = require("../../app/controllers/staff");
const theaterController = require("../../app/controllers/theater");
const ticketTypeController = require("../../app/controllers/ticketType");
const ticketTypeGroupController = require("../../app/controllers/ticketTypeGroup");
const windowController = require("../../app/controllers/window");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        mongoose.connect(process.env.MONGOLAB_URI);
        yield schemaController.dropCollections();
        yield ticketTypeController.createFromJson();
        yield ticketTypeGroupController.createFromJson();
        yield filmController.createFromJson();
        yield theaterController.createFromJson();
        yield theaterController.createScreensFromJson();
        yield performanceController.createFromJson();
        yield memberController.createFromJson();
        yield staffController.createFromJson();
        yield windowController.createFromJson();
        // 時間がかかってしまうので、一時的にコメントアウト
        // await staffController.createReservationsFromJson();
        // await memberController.createReservationsFromJson();
        mongoose.disconnect();
    });
}
// tslint:disable-next-line:no-floating-promises
main().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error(err);
});
