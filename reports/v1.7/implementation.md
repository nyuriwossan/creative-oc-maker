# v1.7 実装・検証報告

開始時/最終照合時のupstream mainは `83cd24b18eec84468bc2793e6d634b6731920a01`。AGENTS.mdはありません。添付仕様の順に、原本監査・変換→辞典UI→固定名連携→自然・古典ガチャ→回帰検証を実施しました。既存のindex.htmlを局所改修し、既存の名前データや保存キーは維持しています。

## 機能・変更ファイル

- `scripts/build_dictionary.py`、`data/raw/name-dictionary/*`、`data/dictionary-v1.7.json`、`data/dictionary-v1.7-overrides.json`：原本保持、再現可能な共通JSON、分類・追跡・出典差分。
- `dictionary.html`、`dictionary.css`、`js/dictionary-core.js`、`js/dictionary-page.js`：直リンク対応辞典、全件検索/50音/12ジャンル/小分類/用途/印象、36件ずつ表示、詳細、コピー、独立お気に入り、削除IDと保存不可の通知。
- `index.html`：ナビゲーション、ID解決と固定解除、固定名の1/5人生成、設定だけの手入力優先、由来・参考資料の保存とコピー、自然・古典モチーフの用途/ジャンル選択。保存レコードの破損耐性と属性中IDのエスケープも補強。
- `verify-dictionary.cjs`、`verify-dictionary-gacha.cjs`、`verify-browser-dictionary.cjs`、`tests/static-server.cjs`：新機能と既存出力の比較テスト。
- 既存の `verify-naming.cjs` / `verify-ten-names.cjs`：新系統にも同じ全系統テストを適用するためJSONフィクスチャを注入。
- 既存ブラウザ4スクリプト：単一HTMLを返すテストサーバーを静的ファイル配信に変更。Edge固定を外し `BROWSER_EXECUTABLE` 対応。`verify.cjs` の古いv1.5フッター期待値と `verify-browser.cjs` のv1.6タイトル期待値をv1.7へ更新。テストの生成条件や重複制約を弱めていません。
- `.gitattributes`：原本CSVのBOM/CRLFをそのまま保持。`README.md`、`CHANGELOG.md`、本報告・品質レポート・ブラウザ記録を追加。

## データの結果・未確認事項

675件、38列、ID一意、ND389/NEW264/SUP22。鳥類113、鉱物・宝石95、蝶・蛾・昆虫95、日本の伝統色108、古語・雅語32、香木・香料32、月・暦・季語40、海洋生物32、気象・自然現象32、伝統文様32、和楽器・雅楽32、金属・工芸素材32。全件の読み・検索キーと12分類への対応を確認しています。

**名称・読み・由来の個別原典照合は全675件で未実施です。** `reviewRequired=true` を全件保持し、確認済みとは表示しません。これは構造・プログラムの検証であり、名称の学術的検証ではありません。

名称・読みは変更ゼロ。SUP-017〜022の鳥類URL6件だけ、参考リンクから外して差分理由と元記録を保持しました。SUP22件の漢字・読み・異表記関係は未確定です。元のHOM群に別義が含まれるため独立IDを維持し、同義と思われる時雨も統合していません。分野共通URLは直接立証資料ではないと明記しています。

原本SHA-256 `b1601520f6cab12d5f10cea2abd1507fe127d93824e395580ba9d0f3759512e9` は添付ZIP内のCSVと一致。全件の元ID→出力ID、分類件数、差分6件は `data-quality.json` に記録しています。旧名前JSONと埋め込みデータブロックは変更していません。

## テスト結果

すべて成功。実行コマンドの一覧はREADMEにもあります。

| コマンド | 結果 |
| --- | --- |
| `python scripts/build_dictionary.py --check` | 再生成一致、675/389/264/22、12分類、原本保持 |
| `node verify-dictionary.cjs` | 原本ハッシュ、検索/行判定、同名別義、出典・未確認状態、お気に入り再読込/解除/保存不可/破損 |
| `node verify-dictionary-gacha.cjs /tmp/oc-v1.6-baseline.html` | v1.6と同じ乱数で2,592通りの全生成項目が一致（時刻由来IDのみ除外）。固定名、全12ジャンル×5用途、履歴・0件・少数候補 |
| `node verify-ten-names.cjs` | 新系統を含む全系統の10個、性別/文化/着想、少数候補と他モード |
| `node verify-science-medical.cjs` | 6分野×用途、60,000回の既存分布検証、履歴、用途、0件、5人モード |
| `node verify-naming.cjs reports/v1.7/naming-regression.json` | 13チェック、269,200サンプル |
| `node verify-kanji-myth.cjs reports/v1.7/kanji-myth-regression.json` | データ、字体・伝承分布、創作読み表示、バッチ・失敗時の結果保持 |
| `node verify-expansion.cjs reports/v1.7/expansion-regression.json` | 既存追加282件と分類/読みの整合 |
| `node verify.cjs index.html reports/v1.7/generator-regression.json` | 単名216,000回、5人バッチ36,000回、既存系統・設定・同名回避 |
| `node build-names.cjs --check` / `node build-kanji-myth.cjs --check` / `node build-science-medical.cjs --check` | 全既存埋め込みデータが正本と一致 |
| `BROWSER_EXECUTABLE=/usr/bin/chromium node verify-browser-dictionary.cjs` | 辞典→花鶏固定→1/5人→コピー/保存/再読込→解除、新系統10個、検索/詳細/お気に入り、0件/エラー/再試行、改ざん耐性、5画面幅。pageErrors=0 |
| `BROWSER_EXECUTABLE=/usr/bin/chromium node verify-browser.cjs reports/v1.7/legacy-browser` | 旧保存/追加/削除、3モード、焦点、コピー、ファンタジー、画像プロンプト、失敗時の結果維持 |
| `BROWSER_EXECUTABLE=/usr/bin/chromium node verify-browser-v15.cjs reports/v1.7/kanji-myth-browser` | 一字/創作読み/神話、再保存、詳細、設定だけ/フル、世界観独立 |
| `BROWSER_EXECUTABLE=/usr/bin/chromium node verify-browser-science.cjs reports/v1.7/science-browser` | 科学医学の選択/用語/由来/コピー/保存と旧保存互換 |
| `BROWSER_EXECUTABLE=/usr/bin/chromium node verify-null-name-display.cjs reports/v1.7/null-display-regression.json` | 読み・英字の欠損表示、旧保存、コピー形式 |

Playwright 1.62.1、Linux Chromiumの実ブラウザで検証。辞典・ガチャを320/375/390/430/768px、タッチ操作相当で確認し、横はみ出しなし。全幅の画面は `dictionary-browser/` に保存しました。390px辞典の展開画面を目視確認しています。iPhone実機・iOS Safari/WebKit・Firefoxは未検証で、ChromiumのモバイルエミュレーションをSafari実機確認とは扱いません。

ブラウザで見つかった検索入力のblur時の再描画により最初の詳細クリックが失われる問題を修正し、最終テストを再実行しました。URLを名前として挿入せず、辞典IDで解決します。辞典の文字列はテキストノード、ガチャの由来はエスケープし、出典URLはhttp(s)に制限します。壊れた辞典、悪意ある表示テキスト・URL、URLパラメータ、壊れた/不正な旧保存、localStorage利用不可もブラウザで確認しています。

## デプロイ・保留

専用のローカルブランチ `codex/v1.7-name-dictionary` に4段階のコミットを作成しました。Git送信はHTTP 403（Permission denied）、GitHub連携のブランチ作成もHTTP 403（Resource not accessible by integration）で拒否されたため、リモートへの送信・PR作成は未実施です。メタデータではpush権限が表示されましたが、実際の書き込みは許可されませんでした。mainへのマージとGitHub Pagesへの本番反映は実施していません。従って公開URLは従来版のままで、v1.7の公開動作は未確認です。反映先は <https://nyuriwossan.github.io/creative-oc-maker/> と <https://nyuriwossan.github.io/creative-oc-maker/dictionary.html>。GitHub Pagesは相対パス・サブパス対応済みですが、マージ後のビルド完了と実URLの確認が必要です。

配布するGit bundleには既存mainを親とする4コミットを含み、元リポジトリにそのまま取得できます。ソースZIPとパッチも同梱します。GitHubへの反映には実際に書き込み可能な接続または利用者側でのpushが必要です。

保留は全675件の個別資料照合、SUP表記照合、同義重複の編集判断、Safari等の実機検証、main反映と本番確認です。名/姓の片側固定は今回実装せず、仕様の必須範囲である単名固定を実装しました。
