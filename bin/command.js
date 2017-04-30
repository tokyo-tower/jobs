"use strict";
/**
 * タスクコマンドルーター
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
const program = require("commander");
const EmailQueueController = require("../app/controllers/emailQueue");
const FilmController = require("../app/controllers/film");
const GMOController = require("../app/controllers/gmo");
const MemberController = require("../app/controllers/member");
const PerformanceController = require("../app/controllers/performance");
const ReservationController = require("../app/controllers/reservation");
const SchemaController = require("../app/controllers/schema");
const StaffController = require("../app/controllers/staff");
const TestController = require("../app/controllers/test");
const TheaterController = require("../app/controllers/theater");
const TicketTypeController = require("../app/controllers/ticketType");
const TicketTypeGroupController = require("../app/controllers/ticketTypeGroup");
const WindowController = require("../app/controllers/window");
program
    .version('0.0.1');
program
    .command('test <method>')
    .description('テストタスク')
    .action((method) => {
    TestController[method]();
});
program
    .command('gmo <method>')
    .description('GMO結果通知処理タスク')
    .action((method) => {
    GMOController[method]();
});
program
    .command('staff <method>')
    .description('内部関係者タスク')
    .action((method) => {
    StaffController[method]();
});
program
    .command('performance <method>')
    .description('パフォーマンスタスク')
    .action((method) => {
    PerformanceController[method]();
});
program
    .command('performance updateStatuses')
    .description('空席状況更新タスク')
    .action(() => __awaiter(this, void 0, void 0, function* () {
    yield PerformanceController.updateStatuses();
}));
program
    .command('releasePerformance <performanceId>')
    .description('ID指定でパフォーマンスを公開するタスク')
    .action((performanceId) => {
    PerformanceController.release(performanceId);
});
program
    .command('theater <method>')
    .description('劇場タスク')
    .action((method) => {
    TheaterController[method]();
});
program
    .command('ticketType <method>')
    .description('券種タスク')
    .action((method) => {
    TicketTypeController[method]();
});
program
    .command('ticketTypeGroup <method>')
    .description('券種グループタスク')
    .action((method) => {
    TicketTypeGroupController[method]();
});
program
    .command('film <method>')
    .description('作品タスク')
    .action((method) => {
    FilmController[method]();
});
program
    .command('member <method>')
    .description('メルマガ会員タスク')
    .action((method) => {
    MemberController[method]();
});
program
    .command('window <method>')
    .description('当日窓口タスク')
    .action((method) => {
    WindowController[method]();
});
program
    .command('reservation <method>')
    .description('予約関連タスク')
    .action((method) => {
    ReservationController[method]();
});
program
    .command('emailQueue <method>')
    .description('メールキュー関連タスク')
    .action((method) => {
    EmailQueueController[method]();
});
program
    .command('schema <method>')
    .description('スキーマ関連タスク')
    .action((method) => {
    SchemaController[method]();
});
// program
//   .command('*')
//   .action(function(env){
//     console.log('deploying "%s"', env);
//   });
program.parse(process.argv);
