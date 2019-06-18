/**
 * 予約データをChevre型へ移行するスクリプト
 */
const ttts = require('@motionpicture/ttts-domain');
const moment = require('moment');

async function main() {
    await ttts.mongoose.connect(process.env.MONGOLAB_URI);

    const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection)

    // const reservations = await reservationRepo.search({
    //     status: ttts.factory.reservationStatusType.ReservationConfirmed,
    //     performanceStartFrom: moment().add(-1, 'months').toDate(),
    //     performanceStartThrough: moment().add(-0, 'months').toDate(),
    // });
    // console.log(reservations.length, 'reservations found');


    const days = []
    let day;
    for (day = 20190601; day <= 20190618; day++) {
        days.push(day);
    }
    // for (day = 20190301; day <= 20190331; day++) {
    //     days.push(day);
    // }
    // for (day = 20190401; day <= 20190430; day++) {
    //     days.push(day);
    // }
    // for (day = 20190501; day <= 20190531; day++) {
    //     days.push(day);
    // }
    console.log(days);

    for (const day of days) {
        const reservations = await reservationRepo.reservationModel.find({
            status: ttts.factory.reservationStatusType.ReservationCancelled,
            performance_day: String(day),
            // performanceStartFrom: moment().add(-3, 'months').toDate()
        }).exec().then((docs) => docs.map((doc) => doc.toObject()));
        console.log(reservations.length, 'reservations found', day);

        await Promise.all(reservations.map(async (reservation) => {
            const update = {
                reservationStatus: reservation.status
            };

            await reservationRepo.reservationModel.findOneAndUpdate(
                { _id: reservation.id },
                update
            ).exec();
            console.log('reservation updated', reservation.id);
        }));
    }
}

main()
    .then(() => {
        console.log('success!')
    })
    .catch(console.error);
