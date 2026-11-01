# 創作OCメーカー v1.7

GitHub Pagesで動く静的なOC生成ツールです。登録・サーバー・APIキー・外部CDNは不要です。

- ガチャ：<https://nyuriwossan.github.io/creative-oc-maker/>
- 名前辞典：<https://nyuriwossan.github.io/creative-oc-maker/dictionary.html>

上記はmainの公開URLです。v1.7は変更ブランチからmainへ反映してPagesのビルドが完了するまで公開されません。

## 使い方

「名前辞典」で名称・読み・説明・別表記・原語を検索できます。50音の行、12ジャンル、小分類、用途（複数はOR条件）、印象で絞り込み、カードの詳細から確認状況と参考資料を見られます。36件ずつ追加表示します。コピーは名称と読みを一緒にコピーし、ブラウザで許可されない場合は選択用テキストを表示します。

お気に入りはこの端末のブラウザに保存します。お気に入りだけの一覧、読み順・登録順の切り替え、解除ができます。「この名前でOCを作る」を押すと、その辞典IDを検証し、名称・読みを**単名として固定**します。5人生成でも同じ名前の異なる設定を作れます。「設定だけ」では固定を一時停止し、従来の手入力を使います。「固定を解除」または条件リセットで解除します。辞典名での保存・詳細コピー・名前コピー・画像生成用プロンプト素材のコピーも使えます。

名前の詳細設定に「自然・古典モチーフ」を追加しました。ジャンルは複数選択でき、未選択なら全ジャンルです。初期用途は「候補すべて（おすすめ用途で絞らない）」。人物名・姓/家名・異名/コードネーム・組織/地名の編集上のおすすめでも絞れます。どの用途でも素材語を改変せず単名として使い、姓や読み・英字表記を作り足しません。性別は人物設定に使い、名称の男女適性を捏造しません。最近20件を避け、10個生成では同じ表示名を重複させず、候補が少なければ全候補を表示します。0件は他ジャンルに置き換えず条件変更を案内します。

## データと確認状況

**全675件が個別出典の再確認中です。** 人名の実在証明ではありません。用途・印象は創作用の編集判断です。付属の先行調査を、この再構築CSVの検証完了の証明としては使いません。

原本は `data/raw/name-dictionary/03_master_675_reconstructed.csv`（675行・38列、UTF-8 BOM/CRLF）です。添付ZIPの `README_FIRST.md` と `manifest.json` も同じディレクトリに保持しています。原本のSHA-256は `b1601520f6cab12d5f10cea2abd1507fe127d93824e395580ba9d0f3759512e9`。旧v1.6の名前データは置き換えていません。

```sh
python scripts/build_dictionary.py
python scripts/build_dictionary.py --check
node verify-dictionary.cjs
```

Python標準ライブラリだけで、辞典とガチャが共用する `data/dictionary-v1.7.json` と品質レポート `reports/v1.7/data-quality.json` を再生成します。ID、元の用途フラグ、原分類、元の出典・確認状態を保持します。ND389件の `name_use=0` も全件検索・直接選択の対象です。

| ジャンル | 件数 |
| --- | ---: |
| 鳥類 | 113 |
| 鉱物・宝石 | 95 |
| 蝶・蛾・昆虫 | 95 |
| 日本の伝統色 | 108 |
| 古語・雅語 | 32 |
| 香木・香料 | 32 |
| 月・暦・季語 | 40 |
| 海洋生物 | 32 |
| 気象・自然現象 | 32 |
| 日本の伝統文様 | 32 |
| 和楽器・雅楽 | 32 |
| 金属・工芸素材 | 32 |
| **合計** | **675** |

ND/NEW/SUPは389/264/22件です。名称・読み・語源の推測補完や改変はしていません。SUP-017〜022の昆虫6件は鳥類目録を参考リンクから除外し、原記録を `rawSource` に残しました。変更理由は `data/dictionary-v1.7-overrides.json` に記録しています。SUP22件の漢字表記は未照合、異表記リンクは未確定です。

原本のHOM群は同表記別義も含むため、`canonicalGroup` は独立IDとし、元の群を `relatedGroupUnconfirmed` に保持します。「青海波」（文様/雅楽）、「霰」（気象/文様）、「時雨」の各IDを削除しません。関連候補は未確認と明示します。

検索はNFKC、英字小文字化、カタカナ→ひらがな、空白・中黒の除去、小書き仮名→対応する大きい仮名で正規化します。表示原文は不変です。濁音・半濁音は検索では区別し、50音行の判定だけ清音化します（が→か行、ぱ→は行、ヴ→あ行、ゃ→や行、っ→た行）。長音「ー」は検索では保持し、語頭にある場合だけ行判定で読み飛ばします。母音の推定や英字→読みの推測はしません。読みの日本語照合順→表記→IDで安定ソートします。

## 保存の互換性

既存OC保存キー `ocMakerSavedV1` は変更しません。辞典のお気に入りは別キー `ocMakerDictionaryFavoritesV1` に `{version:1, ids:[...]}` を保存します。存在しなくなったIDは別名称へ置換せず通知します。保存領域の利用不可時は、辞典はメモリ内のお気に入りを利用し永続化不可を通知します。破損したOCレコードは表示時に除外し、自動で保存内容を書き換えません。

公開時の配信URLは同じオリジン・サブパスを維持してください。オリジンやブラウザが変わるとlocalStorageは共有されません。

## 開発・検証

JSONの取得が必要なので、`file://` ではなくHTTPで開きます。

```sh
python -m http.server 8000
# http://localhost:8000/dictionary.html
```

Node.js 18以上とPython 3が必要です。ブラウザテストのみPlaywrightを使います（今回の検証環境はPlaywright 1.62.1 + Chromium）。実行用に `npm install --no-save playwright@1.62.1`、必要に応じ `npx playwright install chromium` を実行してください。アプリの公開動作にnpmやPlaywrightは不要です。

```sh
python scripts/build_dictionary.py --check
node verify-dictionary.cjs
git show 83cd24b18eec84468bc2793e6d634b6731920a01:index.html > /tmp/oc-v1.6-baseline.html
node verify-dictionary-gacha.cjs /tmp/oc-v1.6-baseline.html
node verify-ten-names.cjs
node verify-science-medical.cjs
node verify-naming.cjs
node verify-kanji-myth.cjs
node verify-expansion.cjs
node verify.cjs
node build-names.cjs --check
node build-kanji-myth.cjs --check
node build-science-medical.cjs --check
node verify-browser-dictionary.cjs
node verify-browser.cjs
node verify-browser-v15.cjs
node verify-browser-science.cjs
node verify-null-name-display.cjs
```

独自のChromiumを使う場合は `BROWSER_EXECUTABLE=/usr/bin/chromium node ...` のように指定できます。ブラウザテストはローカルHTTP配信のみで実行し、外部出典へのアクセスはしません。`verify-science-sources.cjs` は旧データの外部URL確認用で、今回の675件の個別確認には使いません。テスト結果・画面・未確認事項は `reports/v1.7/implementation.md` を参照してください。
