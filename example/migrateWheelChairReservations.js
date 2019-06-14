/**
 * 車椅子予約データ移行スクリプト
 */
const ttts = require('@motionpicture/ttts-domain');
const moment = require('moment');

async function main() {
    await ttts.mongoose.connect(process.env.MONGOLAB_URI);
    const redisClient = ttts.redis.createClient({
        port: Number(process.env.REDIS_PORT),
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_KEY,
        tls: { servername: process.env.REDIS_HOST }
    });

    const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection)
    const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection)
    const stockRepo = new ttts.repository.Stock(redisClient);

    const reservations = await reservationRepo.reservationModel.find({
        // _id: 'TT-190609-908000-0',
        status: ttts.factory.reservationStatusType.ReservationConfirmed,
        performance_day: { $gte: '20190605' },
        'ticket_ttts_extension.category': ttts.factory.ticketTypeCategory.Wheelchair
    });
    console.log(reservations);
    console.log(reservations.length, 'reservations found');

    await Promise.all(reservations.map(async (reservation) => {
        const event = await performanceRepo.findById(reservation.performance);
        let availableSeats = event.screen.sections[0].seats;
        const unavailableStocks = await stockRepo.findUnavailableOffersByEventId({ eventId: event.id });
        const unavailableSeatNumbers = unavailableStocks.map((s) => s.seatNumber);
        availableSeats = availableSeats.filter((s) => unavailableSeatNumbers.indexOf(s.branchCode) < 0);

        // 余分確保分をロック
        const selectedSeats = availableSeats.slice(0, 6);
        console.log('locking...', selectedSeats.length, 'seats', selectedSeats);
        await stockRepo.lock({
            eventId: event.id,
            offers: selectedSeats.map((s) => {
                return {
                    seatSection: '',
                    seatNumber: s.branchCode
                };
            }),
            expires: moment(event.endDate).add(1, 'month').toDate(),
            holder: reservation.transaction
        });
        console.log('locked', reservation.id);

        // 予約に余分確保情報を追加
        await reservationRepo.reservationModel.findOneAndUpdate(
            { _id: reservation.id },
            {
                additionalProperty: [
                    {
                        name: 'extraSeatNumbers',
                        value: JSON.stringify(selectedSeats.map((s) => s.branchCode))
                    }
                ]
            }
        ).exec();
        console.log('reservation updated', reservation.id);
    }));
}

main()
    .then(() => {
        console.log('success!')
    })
    .catch(console.error);
