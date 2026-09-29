# v1.4 名前素材の拡張

GitHub main の `835eee698d086e11dced5a0c5dfb7335c6c5458f`（v1.3）を確認して改修。既存の配列・抽選・保存キーを維持し、名前の候補と任意メタデータを追加しました。アプリは引き続き `index.html` 単体で動作します。

## 件数

|用途|追加登録数|
|---|---:|
|現代日本の姓|50|
|現代日本の中性名（一文字）|11|
|和風の家名|38|
|和風の名：男性／女性／中性|12／12／12|
|西洋ファンタジーの名|67|
|西洋ファンタジーの一般家名|32|
|王侯貴族向け家名|24|
|SFコードネーム|24|
|合計|282|

日本名61件、和風74件。数はフルネームの組み合わせ数ではなく配列の追加登録数です。nameData は2,162→2,444登録。既存の現代欧米422レコードと素材84レコードはそのままです。既存の別性別・別系統と同じ表示を再利用した7登録を除くと、nameData 内で新しい表示表記は275種類です。未登録の難読名や似た語尾だけで数を稼がず、依頼の件数目安を下回るところで選定を止めました。

一文字名は既に170件の中性プールがありました。「要・新・巴・譲・豊・尊・栄・温・絆・織・恵」を11登録追加。「薫」は既存と同一、「周・皐・汀」は既存の読みと重なるので除外しています。性別区分は創作上の印象であり、男女の実際の使用頻度や性自認を示すものではありません。

## 選定・由来の扱い

地名資料から20候補を選別し、比較的短く姓になじむ10候補は現代日本、土地・領地を連想する10候補は和風へ分離。その他の姓は日常的な形と草木・水辺の創作家名から個別に編集しました。地名の存在を同じ姓の実在根拠にしたり、姓の由来・血縁を断定したりしません。極端な難読地名、長い地形名、強く作品を想起する名前は除外記録に残しました。

イタリア語・フランス語・ラテン語は、素材語の一部を抽出し、音節の短縮・子音や母音の再配置・土地名を思わせる構成を個別に選定。掲載順の取り込み、接尾辞の自動総当たり生成はありません。`derivation` に編集方法を記録しています。同じ候補の中では一つの言語の音を基調にし、異なる言語の語根を機械的に混ぜていません。綴りが偶然実在名と重なる可能性はありますが、今回の欧州風派生候補はすべて創作候補として扱い、実在人名の語源を主張しません。カナは厳密な発音記号ではなく創作用の読みです。

現代欧米の国別プールには創作名を入れず、西洋ファンタジーの旧来プールへ追記。そこに残るアーサー等の人名寄り候補と創作候補が混ざります。一般家名と長めの領地・王家風家名を別配列に保ち、王侯世界観の従来テーマでは貴族家名を選びます。フルネーム全体を同じ国の組に制限する機能は今回追加していません。

宝石・星座はv1.3で既に追加済みのため重ねて大量登録せず、今回は花、工房、音楽、草木、季節、火、魂、時間、真実などを拡充。SFは鳥・植物・天候・鉱物と機器のイメージを組み合わせた識別名とし、一般語を人名だとは扱いません。

今回のカテゴリ：`architecture, art, bird, color, earth, emotion, fire, flower, knowledge, light, mineral, music, place, plant, season, sky, soul, time, truth, water, weather`。言語は `japanese, italian-inspired, french-inspired, latin-inspired, german-inspired, english-inspired`。

## データと保守

- `data/names-v1.4.json`：追加候補・出典の正本。既存の `kanji/reading/kana/roman/g/tags` を保ち、`language/motif/style/sourceTerm/meaning/derivation/source/originType/addedVersion` を任意フィールドとして追加。
- `build-names.cjs`：正本からHTMLのマーカー内だけを生成。各配列に `push` で追記。既存コードを大規模に再生成しません。公開時の外部JSON取得は不要。
- `index.html`：v1.4表記、追加ブロック、既存アダプターから `nameParts` へのメタデータ引き継ぎ。既にある折りたたみ内に素材の意味と編集意図を表示。新しい操作UIは追加していません。
- `data/baseline-v1.3.json`：旧配列の長さと内容ハッシュ。旧2,162登録の順序と全フィールドを検証。
- `data/excluded-v1.4.json`：重複14候補と編集上の除外判断。
- `verify.cjs / verify-naming.cjs / verify-expansion.cjs / verify-browser.cjs`：回帰・抽選・データ・ブラウザー検査。
- `reports/v1.4/`：検査結果、全プールの重複一覧。

生成・履歴の確率設計は変更していません。タグの重み上限1.75、表示済み履歴20件、5人内の完全同名回避、失敗時の結果・履歴保持を維持。安定ID、保存キー `ocMakerSavedV1` と従来の保存オブジェクト形式も維持しました。

## 重複と検証

同じプール内に新しい display・kanji・reading・kana・roman 重複なし。既存の中国語女性名「婉清／晩晴」は変更していません。別プールの同音異字は「呉羽／紅葉」「志貴／織」「要／要人」「尊／水琴」「春乃／春野」の5群が今回の追加と関係します。reading と roman それぞれの10検出行として報告。同じ漢字「尊」の男性候補は「たける」、追加中性候補は「みこと」で、構成要素の読み・romanまで一致させるテストに補強しています。別性別・別系統の再利用を同一プールの重複と混同しません。

全18世界観（お任せを含む）×全12性別指定×1,000回＝216,000回の単体生成、名前のみ／全項目の5人生成36,000バッチ＝180,000人分、闇系10,000回を検証。5人内同名、空欄、undefined、意図しない名無しなし。設定のみ・名前未入力の意図した名無しは従来どおりです。既存の抽選・出典・履歴検査267,600試行も維持。

追加検査は固定乱数で現代日本・和風・西洋・王侯を各12,000回。最大フルネーム出現率0.042%以下。指定のAI寄り漢字を含む名の割合は日本4.49%、和風4.96%、指定の西洋語頭は一般西洋0.65%、王侯0%。これはこの条件での実測で、全条件の上限ではありません。名の自然さは全候補の編集確認と標本確認で評価し、機械検査だけで保証したとは扱いません。

Edgeで旧保存の表示・コピー・削除、新規保存・再読込、各コピー、手入力・名前なし、失敗後の復帰、キーボード操作、390px幅、新しい由来表示とメタデータの保存を確認。Safari・Firefox・実機スマートフォンは未検証。

```sh
node build-names.cjs --check
node verify.cjs index.html regression-test-report.json
node verify-naming.cjs naming-test-report.json
node verify-expansion.cjs expansion-test-report.json
# PlaywrightとEdgeのある環境で実行（アプリ本体の依存ではありません）
node verify-browser.cjs test-results
```

## 参考資料

2026-09-29に内容を確認。用語集は着想用の二次資料として使用し、一覧の自動取り込みはしていません。

- 指定資料：[難読地名](https://kakkoii-yougosyuu.com/archives/1034849658.html)、[一文字の中性名](https://kakkoii-yougosyuu.com/archives/name-ichimoji.html)、[イタリア語](https://kakkoii-yougosyuu.com/archives/italian-naming.html)、[フランス語](https://kakkoii-yougosyuu.com/archives/french-naming.html)、[ラテン語](https://kakkoii-yougosyuu.com/archives/naming-latin.html)、[入口](https://kakkoii-yougosyuu.com/)。
- 追加確認：[イタリア語の追加語彙](https://kakkoii-yougosyuu.com/archives/naming-italian.html)、[フランス語の追加語彙](https://kakkoii-yougosyuu.com/archives/french-stylish.html)、[ドイツ語](https://kakkoii-yougosyuu.com/archives/german-naming.html)、[英語](https://kakkoii-yougosyuu.com/archives/english-commonplace.html)。古英語としての根拠がないものは古英語と分類していません。
- 比較・採否判断：[和風姓](https://kakkoii-yougosyuu.com/archives/lastneme-osyare.html)、[珍しい姓](https://kakkoii-yougosyuu.com/archives/1034846072.html)、[動植物](https://kakkoii-yougosyuu.com/archives/category/doubutsu)、[自然の漢字](https://kakkoii-yougosyuu.com/archives/kanji-nature.html)、[天体の漢字](https://kakkoii-yougosyuu.com/archives/kanji-moon.html)、[色・宝石](https://kakkoii-yougosyuu.com/archives/colorjewelry.html)、[感情](https://kakkoii-yougosyuu.com/archives/category/emotion)。これらのページを読んだことは全項目を採用したという意味ではありません。色ページの amarillo はイタリア語とされているため採用せず、疑わしい表記・言語分類は持ち込んでいません。
- 語義の補助確認：[Treccani fiore](https://www.treccani.it/vocabolario/fiore/)、Wiktionaryのラテン語項目 [ignis](https://en.wiktionary.org/wiki/ignis#Latin)、[anima](https://en.wiktionary.org/wiki/anima#Latin)、[tempus](https://en.wiktionary.org/wiki/tempus#Latin)、[veritas](https://en.wiktionary.org/wiki/veritas#Latin)。辞書の語義と派生候補の編集意図は別フィールドに保持。

作品・ブランドを強く想起する素材を手動除外し、一部の派生綴りも検索で確認しました。全世界の固有名詞・商標を網羅した照合ではありません。

## 次回のモチーフ選択UI

既存の言語・テーマ選択を残し、独立した任意の「内容モチーフ」フィルターを折りたたみ内に配置できます。`language` と `motif` を分け、役割・系統・性別で絞った後に選択モチーフを適用。複数選択はOR、同じレコードは安定IDで重複除去し、テーマごとに候補数が違っても件数だけで確率が決まらない設計にします。

未分類の既存名を推測で分類せず「未分類」として保持。0件なら明示的な条件緩和を表示し、黙って他文化・他モチーフへ飛ばさない方針。履歴キーには選択モチーフを含め、保存には選択条件と表示時の構成要素を残します。v1.3の `german/gemstone/constellation` は言語と素材が混在する旧テーマなので、互換用IDを保ちながら新しい内容モチーフへ対応表を用意します。
