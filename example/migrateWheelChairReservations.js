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

    const reservationRepo = new ttts.repository.Reservation(ttts.mongoose.connection)
    const stockRepo = new ttts.repository.Stock(redisClient);


    const reservations = await reservationRepo.reservationModel.find({
        // ids: ['TT-190609-908000-0']
        status: ttts.factory.reservationStatusType.ReservationConfirmed,
        performance_day: { $gte: '20190610' },
        'ticket_ttts_extension.category': ttts.factory.ticketTypeCategory.Wheelchair
    });
    console.log(reservations);
    console.log(reservations.length, 'reservations found');

    const seatCode = 'W-01';

    await Promise.all(reservations.map(async (reservation) => {
        const newStock = {
            id: `${reservation.performance}-${seatCode}`,
            seat_code: seatCode,
            availability_before: ttts.factory.itemAvailability.InStock,
            availability_after: ttts.factory.itemAvailability.OutOfStock,
            holder: reservation.transaction
        };

        // 古い車椅子在庫を解放
        await Promise.all(reservation.stocks.map(async (stock) => {
            const holder = await stockRepo.getHolder({
                eventId: reservation.performance,
                offer: {
                    seatSection: '',
                    seatNumber: stock.seat_code
                },
            });
            if (holder === stock.holder) {
                await stockRepo.unlock({
                    eventId: reservation.performance,
                    offer: {
                        seatSection: '',
                        seatNumber: stock.seat_code
                    },
                });
                console.log('unlocked', reservation.id, stock.seat_code);
            }
        }));

        // 新しい車椅子在庫をロック
        await stockRepo.unlock({
            eventId: reservation.performance,
            offer: {
                seatSection: '',
                seatNumber: newStock.seat_code
            }
        });
        await stockRepo.lock({
            eventId: reservation.performance,
            offers: [{
                seatSection: '',
                seatNumber: newStock.seat_code
            }],
            expires: moment(reservation.performance_end_date).add(1, 'month').toDate(),
            holder: reservation.transaction
        });
        console.log('locked', reservation.id, newStock);

        // 予約を新しいストックで書き換え
        await reservationRepo.reservationModel.findOneAndUpdate(
            { _id: reservation.id },
            {
                seat_code: newStock.seat_code,
                'reservedTicket.ticketedSeat.seatNumber': newStock.seat_code,
                $addToSet: {
                    stocks: newStock
                }
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
