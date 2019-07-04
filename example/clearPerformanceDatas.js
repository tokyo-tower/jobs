const ttts = require('@motionpicture/ttts-domain');
const moment = require('moment-timezone');

async function main() {
    await ttts.mongoose.connect(process.env.MONGOLAB_URI);

    const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection)

    const now = moment().tz('Asia/Tokyo').startOf('date').toDate();
    console.log(now);

    const result = await performanceRepo.performanceModel.update(
        {
            startDate: {
                $gte: now,
                // $lt: moment(now).add(1, 'day').toDate()
            }
        },
        {
            $unset: {
                day: 1,
                start_time: 1,
                start_date: 1,
                end_date: 1,
                tour_number: 1,
                door_time: 1,
                canceled: 1,
                end_time: 1,
                open_time: 1,
                film: 1,
                screen_name: 1,
                screen: 1,
                theater_name: 1,
                theater: 1,
                tourNumber: 1,
            }
        },
        { multi: true }
    );
    console.log('result:', result);
}

main()
    .then(() => {
        console.log('success!')
    })
    .catch(console.error);
