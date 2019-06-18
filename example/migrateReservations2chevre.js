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
    for (day = 20190101; day <= 20190131; day++) {
        days.push(day);
    }
    // for (day = 20190301; day <= 20190316; day++) {
    //     days.push(day);
    // }
    // for (day = 20190501; day <= 20190531; day++) {
    //     days.push(day);
    // }
    // for (day = 20190601; day < 20190618; day++) {
    //     days.push(day);
    // }
    console.log(days);

    for (const day of days) {
        const reservations = await reservationRepo.reservationModel.find({
            status: ttts.factory.reservationStatusType.ReservationConfirmed,
            performance_day: String(day),
            // performanceStartFrom: moment().add(-3, 'months').toDate()
        }).exec().then((docs) => docs.map((doc) => doc.toObject()));
        console.log(reservations.length, 'reservations found', day);

        await Promise.all(reservations.map(async (reservation) => {
            const update = {
                reservationStatus: reservation.status,
                reservationNumber: reservation.payment_no,
                additionalTicketText: reservation.watcher_name,
                'reservedTicket.ticketedSeat.seatSection': '',
                'reservedTicket.ticketedSeat.seatNumber': reservation.seat_code,
                'reservedTicket.ticketType.id': reservation.ticket_type,
                'reservedTicket.ticketType.identifier': reservation.ticket_type,
                'reservedTicket.ticketType.name': reservation.ticket_type_name,
                'reservedTicket.ticketType.priceSpecification.typeOf': 'UnitPriceSpecification',
                'reservedTicket.ticketType.priceSpecification.price': reservation.ticket_type_charge,
                'reservedTicket.ticketType.priceSpecification.referenceQuantity': {
                    typeOf: 'QuantitativeValue',
                    value: 1,
                    unitCode: 'C62'
                },
                'reservationFor.id': reservation.performance,
                'reservationFor.startDate': moment(reservation.performance_start_date).toDate(),
                'reservationFor.endDate': moment(reservation.performance_end_date).toDate(),
                'underName.name': reservation.purchaser_name,
                'underName.givenName': reservation.purchaser_first_name,
                'underName.familyName': reservation.purchaser_last_name,
                'underName.email': reservation.purchaser_email,
                'underName.telephone': reservation.purchaser_tel,
                'underName.gender': reservation.purchaser_gender,
                'underName.address': reservation.purchaser_address,
                'underName.identifier': [
                    ...(Array.isArray(reservation.transaction_agent.identifier))
                        ? reservation.transaction_agent.identifier.map((p) => {
                            return {
                                name: p.name,
                                value: p.value
                            }
                        })
                        : [],
                    {
                        name: 'age',
                        value: reservation.purchaser_age
                    },
                    {
                        name: 'paymentMethod',
                        value: reservation.payment_method
                    },
                    {
                        name: 'transaction',
                        value: reservation.transaction
                    },
                    {
                        name: 'username',
                        value: reservation.owner_username
                    },
                    {
                        name: 'orderNumber',
                        value: reservation.order_number
                    },
                    {
                        name: 'gmoOrderId',
                        value: reservation.gmo_order_id
                    },
                ]
            };

            // console.log('updating...', update);
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
