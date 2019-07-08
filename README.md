# 東京タワーチケット予約システムジョブアプリケーション

[![CircleCI](https://circleci.com/gh/motionpicture/ttts-jobs.svg?style=svg)](https://circleci.com/gh/motionpicture/ttts-jobs)

## Table of contents

* [Usage](#usage)
* [License](#license)

## Usage

### Environment variables

| Name                                   | Required | Value       | Purpose                                         |
| -------------------------------------- | -------- | ----------- | ----------------------------------------------- |
| `DEBUG`                                | false    | ttts-jobs:* | Debug                                           |
| `NODE_ENV`                             | true     |             | Environment Name                                |
| `SENDGRID_API_KEY`                     | true     |             | SendGrid API Keyf                               |
| `REDIS_HOST`                           | true     |             | Redis Connection                                |
| `REDIS_PORT`                           | true     |             | Redis Connection                                |
| `REDIS_KEY`                            | true     |             | Redis Connection                                |
| `MONGOLAB_URI`                         | true     |             | MongoDB Connection                              |
| `GMO_ENDPOINT`                         | true     |             | GMO Endpoint                                    |
| `GMO_SITE_ID`                          | true     |             | GMO サイトID                                    |
| `EVENT_AGGREGATION_EXPIRES_IN_SECONDS` | true     |             | イベント集計保持期間                            |
| `MAXIMUM_ATTENDEE_CAPACITY`            | true     |             | イベント最大収容人数                            |
| `COGNITO_USER_POOL_ID`                 | true     |             | 入場アカウントを管理するCognitoユーザープールID |
| `AWS_ACCESS_KEY_ID`                    | true     |             | AWSリソースアクセスキー                         |
| `AWS_SECRET_ACCESS_KEY`                | true     |             | AWSリソースアクセスシークレット                 |
| `PROJECT_ID`                           | true     |             | Project ID                                      |
| `USE_CHEVRE`                           | true     |             | Use Chevre Flag                                 |
| `CHEVRE_AUTHORIZE_SERVER_DOMAIN`       | true     |             | Chevre API Settings                             |
| `CHEVRE_CLIENT_ID`                     | true     |             | Chevre API Settings                             |
| `CHEVRE_CLIENT_SECRET`                 | true     |             | Chevre API Settings                             |
| `CHEVRE_API_ENDPOINT`                  | true     |             | Chevre API Settings                             |

## License

ISC
