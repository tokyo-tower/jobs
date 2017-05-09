/**
 * 内部関係者タスクコントローラー
 *
 * @namespace StaffController
 */
// import { Models } from '@motionpicture/chevre-domain';
// import { ReservationUtil } from '@motionpicture/chevre-domain';
// import * as createDebug from 'debug';
// import * as fs from 'fs-extra';
// import * as mongoose from 'mongoose';
// const debug = createDebug('chevre-jobs:controller:staff');
/**
 * スクリーン指定で内部関係者の先抑えを実行する
 *
 * @memberOf StaffController
 */
// export async function createReservationsFromJson(): Promise<void> {
//     // スクリーンごとに内部予約を追加する
//     const screenIds = await Models.Screen.distinct('_id').exec();
//     await Promise.all(screenIds.map(async (screenId) => {
//         debug('createStaffReservationsByScreenId processing...', screenId.toString());
//         await createReservationsByScreenId(screenId.toString());
//         debug('createStaffReservationsByScreenId processed.');
//     }));
// }
// todo オーナースキーマでつくりなおし
// async function createReservationsByScreenId(screenId: string): Promise<void> {
//     const data: string = fs.readFileSync(
//         `${process.cwd()}/data/${process.env.NODE_ENV}/staffReservations_${screenId}.json`,
//         { encoding: 'utf8' }
//     );
//     // 内部関係者をすべて取得
//     const staffs = await Models.Staff.find({}).exec();
//     const staffsByName: {
//         [key: string]: mongoose.Document
//     } = {};
//     for (const staff of staffs) {
//         staffsByName[staff.get('name')] = staff;
//     }
//     let reservations: any[] = [];
//     // スクリーンのパフォーマンスをすべて取得
//     const performances = await Models.Performance.find(
//         { screen: screenId }
//     )
//         .populate('film', 'name is_mx4d copyright')
//         .populate('screen', 'name')
//         .populate('theater', 'name address')
//         .exec();
//     for (const performance of performances) {
//         const paymentNo = await ReservationUtil.publishPaymentNo(performance.get('day'));
//         let reservationsByPerformance = JSON.parse(data);
//         reservationsByPerformance = reservationsByPerformance.map((reservation: any, index: number) => {
//             const staffOfReservation = staffsByName[reservation.staff_name];
//             return {
//                 performance: performance.get('_id'),
//                 seat_code: reservation.seat_code,
//                 status: ReservationUtil.STATUS_RESERVED,
//                 staff: staffOfReservation.get('_id'),
//                 staff_user_id: staffOfReservation.get('user_id'),
//                 staff_email: staffOfReservation.get('email'),
//                 staff_name: staffOfReservation.get('name'),
//                 staff_signature: 'system',
//                 entered: false,
//                 updated_user: 'system',
//                 purchased_at: Date.now(),
//                 watcher_name_updated_at: Date.now(),
//                 watcher_name: '',
//                 film_copyright: performance.get('film').get('copyright'),
//                 film_is_mx4d: performance.get('film').get('is_mx4d'),
//                 film_image: `${process.env.FRONTEND_ENDPOINT}/images/film/${performance.get('film').get('_id')}.jpg`,
//                 film_name: performance.get('film').get('name'),
//                 film: performance.get('film').get('_id'),
//                 screen_name: performance.get('screen').get('name'),
//                 screen: performance.get('screen').get('_id'),
//                 theater_name: performance.get('theater').get('name'),
//                 theater_address: performance.get('theater').get('address'),
//                 theater: performance.get('theater').get('_id'),
//                 performance_canceled: performance.get('canceled'),
//                 performance_end_time: performance.get('end_time'),
//                 performance_start_time: performance.get('start_time'),
//                 performance_open_time: performance.get('open_time'),
//                 performance_day: performance.get('day'),
//                 purchaser_group: ReservationUtil.PURCHASER_GROUP_STAFF,
//                 payment_no: paymentNo,
//                 payment_seat_index: index,
//                 charge: 0,
//                 ticket_type_charge: 0,
//                 ticket_type_name: {
//                     en: 'Free',
//                     ja: '無料'
//                 },
//                 seat_grade_additional_charge: 0,
//                 seat_grade_name: {
//                     en: 'Normal Seat',
//                     ja: 'ノーマルシート'
//                 }
//             };
//         });
//         reservations = reservations.concat(reservationsByPerformance);
//     }
//     debug('creating staff reservations...length:', reservations.length);
//     await Models.Reservation.insertMany(reservations);
//     debug('staff reservations created.');
// }
