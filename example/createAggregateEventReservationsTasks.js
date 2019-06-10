/**
 * イベント予約集計タスク作成
 */
const ttts = require('@motionpicture/ttts-domain');
const moment = require('moment');

async function main() {
    await ttts.mongoose.connect(process.env.MONGOLAB_URI);
    const taskRepo = new ttts.repository.Task(ttts.mongoose.connection);
    const performanceRepo = new ttts.repository.Performance(ttts.mongoose.connection);

    // 未来開催予定のパフォーマンス検索
    const ids = await performanceRepo.distinct('_id', {
        startFrom: moment().add(-1, 'week').toDate()
    });
    console.log(ids.length, 'performances found');

    const tasks = await Promise.all(ids.map(async (id) => {
        const aggregateTask = {
            name: ttts.factory.taskName.AggregateEventReservations,
            status: ttts.factory.taskStatus.Ready,
            runsAt: new Date(),
            remainingNumberOfTries: 3,
            // tslint:disable-next-line:no-null-keyword
            lastTriedAt: null,
            numberOfTried: 0,
            executionResults: [],
            data: { id }
        };

        return taskRepo.save(aggregateTask);
    }));
    console.log(tasks.length, 'tasks saved');
}

main().then(() => {
    console.log('success!');
}).catch(console.error);