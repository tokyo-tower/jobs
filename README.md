<img src="https://motionpicture.jp/images/common/logo_01.svg" alt="motionpicture" title="motionpicture" align="right" height="56" width="98"/>

# 東京タワーチケット予約システムジョブアプリケーション

[![CircleCI](https://circleci.com/gh/motionpicture/ttts-jobs.svg?style=svg&circle-token=86145ada73c0363eac14e60f4449f912b6a17e09)](https://circleci.com/gh/motionpicture/ttts-jobs)


## Table of contents

* [Usage](#usage)
* [Code Samples](#code-samples)
* [Jsdoc](#jsdoc)
* [License](#license)

## Usage

### Environment variables

| Name                                             | Required | Value       | Purpose                               |
| ------------------------------------------------ | -------- | ----------- | ------------------------------------- |
| `DEBUG`                                          | false    | ttts-jobs:* | Debug                                 |
| `NPM_TOKEN`                                      | true     |             | NPM auth token                        |
| `NODE_ENV`                                       | true     |             | 環境名(development,test,productionなど) |
| `SENDGRID_API_KEY`                               | true     |             | GMOリンク決済からの戻り先エンドポイント             |
| `REDIS_HOST`                                     | true     |             | redis host                            |
| `REDIS_PORT`                                     | true     |             | redis port                            |
| `REDIS_KEY`                                      | true     |             | redis key                             |
| `MONGOLAB_URI`                                   | true     |             | mongodb接続URI                        |
| `GMO_ENDPOINT`                                   | true     |             | GMO apiのエンドポイント                       |
| `GMO_SITE_ID`                                    | true     |             | GMO サイトID                             |
| `PERFORMANCE_AGGREGATE_THROUGH_IN_DAYS`          | true     |             | 何日先までパフォーマンスごとの集計データを更新するか     |
| `PERFORMANCE_AGGREGATION_EXPIRES_IN_SECONDS`     | true     |             | パフォーマンスごとの集計データ保持期間             |
| `UPDATE_PERFORMANCE_AVAILABILITY_PERIOD_IN_DAYS` | true     |             | パフォーマンス在庫状況更新期間               |
| `PERFORMANCE_AVAILABILITY_EXPIRES_IN_SECONDS`    | true     |             | パフォーマンス在庫状況のデータ保持期間           |
| `UPDATE_EVENT_OFFERS_PERIOD_IN_DAYS`             | true     |             | イベント販売情報更新期間                  |
| `EVENT_OFFERS_EXPIRES_IN_SECONDS`                | true     |             | イベント販売情報データ保持期間               |
| `COGNITO_USER_POOL_ID`                           | true     |             | 入場アカウントを管理するCognitoユーザープールID      |
| `AWS_ACCESS_KEY_ID`                              | true     |             | AWSリソースアクセスキー                         |
| `AWS_SECRET_ACCESS_KEY`                          | true     |             | AWSリソースアクセスシークレット                     |


## Code Samples

No samples.

## Jsdoc

`npm run doc` emits jsdoc to ./doc.

## License

UNLICENSED
