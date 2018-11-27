/**
 * 売上レポートに対する集計データを更新する
 */
import * as ttts from '@motionpicture/ttts-domain';
import * as moment from 'moment-timezone';

import mongooseConnectionOptions from '../../../../mongooseConnectionOptions';
ttts.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);

main().then(() => {
    ttts.mongoose.disconnect();
});

async function main() {
    // 前日を集計する。UTC時間と日本時間に注意！！
    // 日本時間の深夜にバッチを起動するということは、UTC時間だとまだ日付が変わってない。
    // const targetDate = moment().add('day', -1).format('YYYY/MM/DD');
    let targetDate = '';
    // tslint:disable-next-line:no-magic-numbers
    if (process.argv.length === 3) {
        // tslint:disable-next-line:no-magic-numbers
        targetDate = moment(process.argv[2]).format('YYYY/MM/DD');
    } else {
        targetDate = moment().format('YYYY/MM/DD');
    }
    try {
        await ttts.service.aggregate.report4sales.aggregateSalesByEndDate(
            targetDate
        )(
            new ttts.repository.Reservation(ttts.mongoose.connection),
            new ttts.repository.Transaction(ttts.mongoose.connection),
            new ttts.repository.AggregateSale(ttts.mongoose.connection)
        );
    } catch (error) {
        console.error(`error byEndDate:${targetDate}`);
    }

    try {
        await ttts.service.aggregate.report4sales.aggregateSalesByEventStartDate(
            targetDate
        )(
            new ttts.repository.Reservation(ttts.mongoose.connection),
            new ttts.repository.Transaction(ttts.mongoose.connection),
            new ttts.repository.AggregateSale(ttts.mongoose.connection)
        );
    } catch (error) {
        console.error(`error byEventStartDate:${targetDate}`);
    }
}
