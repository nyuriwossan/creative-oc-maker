# v1.3 名前生成

基準コミットは `6617f3d64aeebfdd9ca660ad12c4b168b0b0b669`（v1.2）。アプリは引き続き `index.html` 一つで動作し、外部APIやビルド環境を必要としません。

## 抽選と互換性

- 世界観と名前の系統を独立。初期値は「世界観に合わせる」。現代欧米の世界観を追加。
- 重みは `1 + 0.75 × 一致した選択タグ数 / 選択タグ数`。タグは重複を除いて計算し、1〜1.75に限定。未指定の雰囲気は生成時に解決した2〜3タグを名前にも渡します。
- `generateName(world, gender, moods, options)` の `options.rng` で乱数を注入可能。`options.system/culture/motifs/history` でUIと独立した試験ができます。
- 履歴は系統・言語圏・性別プール・主テーマごとに、名とフルネーム各20件。バッチ生成では作業用履歴を複製し、画面に表示した後だけ確定。棄却候補や失敗バッチは記録しません。
- 候補を使い切った履歴は古いものから緩和。同一バッチの表示上の完全同名は許可せず、最大128回で終了して画面通知。手入力名は意図的な同名を許可。
- 旧2,162登録は変更せず、安定IDを持つアダプターで接続。姓を表示文字列から推定せず、生成時の `nameParts` を使用。保存キー `ocMakerSavedV1` と旧 `name/reading/roman` を維持。

## 辞書

|言語圏|名|姓|中性名（名の内数）|
|---|---:|---:|---:|
|英語圏|64|30|4|
|ドイツ語圏|60|30|0|
|フランス語圏|63|30|3|
|イタリア語圏|60|30|0|
|スペイン語圏|60|30|0|

457所属、422レコード。旧候補を出典確認のうえ39件再利用、新規383レコード。複数圏の同綴り名は同じレコードの `modernUsage` に読み・男女の用例を分けます。名と姓は同じ言語圏から選び、現代欧米にファンタジー専用の家名は入りません。

中性名の用例が未収録の3圏では、人物の中性的な印象を保持し、男女の名を等確率で選ぶ方針をUIと結果に明記。中性名の用例は統計上の男女両方の登録を示し、個人の性自認を示しません。

ファンタジー素材は84語（ドイツ語40・宝石英語名20・星座24）、旧候補12件を再利用、新規72レコード。Bernsteinはドイツ語と宝石に所属するためテーマの所属数は85ですが、レコードは複製しません。派生造語は0件。BerylとSpinelはSFコードネームとしても維持。

出典はHTML内の `nameSources`、用途ごとの根拠は `modernUsage` と `motifUsage` に記録。一般語を実在の人名と扱わず、旧候補の未確認の語源も断定しません。星座の主格と属格、宝石の鉱物・変種・有機質素材を区別します。カナ・用途・印象は創作のための編集判断です。

主な資料：[SSA](https://www.ssa.gov/oact/babynames/decades/names1980s.html)、[US Census](https://www.census.gov/topics/population/genealogy/data/2010_surnames.html)、[GfdS 名](https://gfds.de/vornamen/beliebteste-vornamen/)、[GfdS 姓](https://gfds.de/vornamen/familiennamen/)、[INSEE 名](https://www.insee.fr/fr/statistiques/8595130)、[INSEE 姓](https://www.insee.fr/fr/statistiques/3536630)、[ボローニャ市 名](https://inumeridibolognametropolitana.it/dati-statistici/graduatoria-ordine-decrescente-dei-nomi-maschili-e-femminili-piu-comuni-tra-i)、[ボローニャ市 姓](https://inumeridibolognametropolitana.it/dati-statistici/graduatoria-ordine-decrescente-dei-cognomi-piu-comuni-bologna-al-31-dicembre)、[INE](https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736177009&idp=1254735572981&menu=resultados)、[Duden](https://www.duden.de/rechtschreibung/Nebel)、[GIA](https://www.gia.edu/gem-encyclopedia)、[国立天文台](https://www.nao.ac.jp/new-info/constellation2.html)。出生統計は成人全体の頻度を示しません。英語圏は米国中心、イタリアの資料は2024年のボローニャ市住民で全国順位とは扱いません。

## 検証

```sh
node verify.cjs index.html regression-test-report.json
node verify-naming.cjs naming-test-report.json
```

既存検査は維持し、追加された現代欧米とテーマ付きファンタジーだけ、構成要素・所属・出典に基づく検査へ分岐。旧配列の件数・重複・タグ・読み、既存系統の再構成検査は残しています。

単体生成216,000回、5人生成36,000バッチ、闇系追加10,000回に合格。v1.3固有の抽選267,600試行・13項目に合格。現代日本／男性／気だるいの3万回比較では蓮の割合が74.567%から0.873%（履歴なし）、0.743%（履歴あり）になりました。他条件への確率上限を意味しません。

Windows Edgeで、旧保存の表示・コピー・削除、新規保存と再読込、名前／詳細／画像用コピー、固定名、エラー時の結果保持、キーボードと390px幅を確認。Safari・Firefox・実機スマートフォンは未検証です。
