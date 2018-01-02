# TTTSタスクアプリケーション

# Getting Started

## Usage

### Environment variables

| Name                                          | Required | Value       | Purpose                               |
| --------------------------------------------- | -------- | ----------- | ------------------------------------- |
| `DEBUG`                                       | false    | ttts-jobs:* | Debug                                 |
| `NPM_TOKEN`                                   | true     |             | NPM auth token                        |
| `NODE_ENV`                                    | true     |             | 環境名(development,test,productionなど) |
| `SENDGRID_API_KEY`                            | true     |             | GMOリンク決済からの戻り先エンドポイント             |
| `REDIS_HOST`                                  | true     |             | redis host                            |
| `REDIS_PORT`                                  | true     |             | redis port                            |
| `REDIS_KEY`                                   | true     |             | redis key                             |
| `MONGOLAB_URI`                                | true     |             | mongodb接続URI                        |
| `GMO_ENDPOINT`                                | true     |             | GMO apiのエンドポイント                       |
| `GMO_SITE_ID`                                 | true     |             | GMO サイトID                             |
| `PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS`       | true     |             | 何日先までパフォーマンスごとの集計データを更新するか     |
| `PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS`  | true     |             | パフォーマンスごとの集計データ保持期間(秒)         |
| `PERFORMANCE_AVAILABILITY_EXPIRES_IN_SECONDS` | true     |             | パフォーマンス在庫状況のデータ保持期間(秒)       |


# tslint

コード品質チェックをtslintで行っています。lintパッケージとして以下を仕様。
* [tslint](https://github.com/palantir/tslint)
* [tslint-microsoft-contrib](https://github.com/Microsoft/tslint-microsoft-contrib)
`npm run check`でチェック実行。改修の際には、必ずチェックすること。

# test
mochaフレームワークでテスト実行。
* [mocha](https://www.npmjs.com/package/mocha)
`npm test`でテスト実行。
