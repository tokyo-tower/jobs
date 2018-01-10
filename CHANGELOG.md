# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/).

## Unreleased
### Added
- 本番環境のjsonマスターデータを追加。

### Changed

### Deprecated

### Removed
- 所有者jsonマスターデータを削除。

### Fixed

### Security


## v7.0.0 - 2018-01-10
### Added
- パフォーマンスに対する返品タスク監視ジョブを追加。
- パフォーマンスに対する供給情報ごとの在庫状況を更新するジョブを追加。
- 入場ゲート情報同期ジョブを追加。
- パフォーマンスごとの集計ジョブを追加。
- マスターインポートジョブを追加。
- 注文作成ジョブを追加。

### Removed
- 所有者コレクションを削除(ユーザー情報をCognitoへ移行)

## v6.0.0 - 2017-12-13
### Changed
- 取引と在庫スキーマを追加。予約を在庫を明確に分離。

### Removed
- 不要ジョブやコードを削除。
