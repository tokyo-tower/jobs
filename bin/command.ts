/**
 * タスクコマンドルーター
 *
 * @ignore
 */

import * as program from 'commander';
import * as mongoose from 'mongoose';

import * as FilmController from '../app/controllers/film';
import * as MemberController from '../app/controllers/member';
import * as PerformanceController from '../app/controllers/performance';
import * as ReservationController from '../app/controllers/reservation';
import * as SchemaController from '../app/controllers/schema';
import * as StaffController from '../app/controllers/staff';
import * as TestController from '../app/controllers/test';
import * as TheaterController from '../app/controllers/theater';
import * as TicketTypeController from '../app/controllers/ticketType';
import * as TicketTypeGroupController from '../app/controllers/ticketTypeGroup';
import * as WindowController from '../app/controllers/window';

mongoose.connect(process.env.MONGOLAB_URI, {});

program
    .version('0.0.1');

program
    .command('test <method>')
    .description('テストタスク')
    .action((method) => {
        (<any>TestController)[method]();
    });

program
    .command('staff <method>')
    .description('内部関係者タスク')
    .action((method) => {
        (<any>StaffController)[method]();
    });

program
    .command('performance <method>')
    .description('パフォーマンスタスク')
    .action((method) => {
        (<any>PerformanceController)[method]();
    });

program
    .command('performance updateStatuses')
    .description('空席状況更新タスク')
    .action(async () => {
        await PerformanceController.updateStatuses();
    });

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
        (<any>TheaterController)[method]();
    });

program
    .command('ticketType <method>')
    .description('券種タスク')
    .action((method) => {
        (<any>TicketTypeController)[method]();
    });

program
    .command('ticketTypeGroup <method>')
    .description('券種グループタスク')
    .action((method) => {
        (<any>TicketTypeGroupController)[method]();
    });

program
    .command('film <method>')
    .description('作品タスク')
    .action((method) => {
        (<any>FilmController)[method]();
    });

program
    .command('member <method>')
    .description('メルマガ会員タスク')
    .action((method) => {
        (<any>MemberController)[method]();
    });

program
    .command('window <method>')
    .description('当日窓口タスク')
    .action((method) => {
        (<any>WindowController)[method]();
    });

program
    .command('reservation <method>')
    .description('予約関連タスク')
    .action((method) => {
        (<any>ReservationController)[method]();
    });

program
    .command('schema <method>')
    .description('スキーマ関連タスク')
    .action((method) => {
        (<any>SchemaController)[method]();
    });

// program
//   .command('*')
//   .action(function(env){
//     console.log('deploying "%s"', env);
//   });

program.parse(process.argv);
