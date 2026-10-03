# v1.6 科学・医学用語の実装記録

開始時の GitHub `main` / `HEAD` は `c95f64e788909efef3f14b93d31813007b6693e0`。作業前に `AGENTS.md`（該当なし）、名前辞書、既存テストを確認した。v1.5 の null 表示修正、世界観と名前のタグ分離、名前だけ10個生成を保持する。

## 変更と使い方

「名前だけ」または「すべてお任せ」で「名前の詳細設定」を開き、「科学・医学用語」を選ぶ。分野は複数指定でき、用途は「名前向け」か「コードネーム向け」。病名・症候、病原体、薬・毒物は初期OFFで個別に追加できる。世界観は変えない。生成例は「シナプス／Synapse／神経細胞と次の細胞の間で信号を伝える接合部」。これは用語の説明であり、キャラの能力・職業を指定しない。結果カードには「名前：科学・医学用語」と実際に解決した分野を表示し、折りたたみ欄には原綴りと出典を示す。

変更ファイルは `index.html`、`data/science-medical-v1.6.json`、`build-science-medical.cjs`、`verify-science-medical.cjs`、`verify-browser-science.cjs`、`verify-science-sources.cjs`、`verify-browser.cjs`、この報告とブラウザ検証記録。正本は JSON で、ビルドスクリプトが単一の `index.html` に埋め込む。公開後に外部API・サーバー・DBは使わない。既存SF候補を移動せず、一致する表記と原綴りは既存レコードへカテゴリ所属を足した。

## 収録数

| 分野 | 所属数 | 新規 | 既存再利用 | 別表記 | 初期条件の名前向け |
| --- | ---: | ---: | ---: | ---: | ---: |
| 物理・数学 | 26 | 23 | 3 | 0 | 24 |
| 化学・元素・物質 | 21 | 20 | 1 | 0 | 21 |
| 天文・宇宙 | 24 | 17 | 7 | 0 | 22 |
| 地学・気象 | 21 | 18 | 3 | 0 | 21 |
| 生命科学・人体 | 25 | 25 | 0 | 0 | 25 |
| 医学・薬学 | 20 | 20 | 0 | 1 | 10 |
| **全体（重複所属を1件と数える）** | **129** | **116** | **13** | **1** | **115** |

8語は複数分野に所属するため、分野別所属数の合計137と全体129は異なる。別表記1件は「ネクローシス／ネクロシス」を同じ `canonicalTermId` にまとめたもので、抽選候補は増やさない。初期条件で使える名前向け115語、コードネーム向け121語。病名・症候3語、病原体2語、薬・毒物3語をONにすると、それぞれ追加される。3種類をすべてONにした名前向けは123語、コードネーム向けは129語。複数タグがある場合は全タグONを要求する。

## 出典と候補台帳

全129語の原綴り、意味、種類、出典キー、確認日、採用理由を JSON に保持する。出典は18群。主な資料は [CERN CMS 用語集](https://cms.cern/index.php/content/glossary)、[CERN アクシオン解説](https://home.cern/science/experiments/cast/)、[NASA 宇宙用語集](https://science.nasa.gov/universe/glossary/)、[Royal Society of Chemistry 元素表](https://periodic-table.rsc.org/)、[USGS 火山用語集](https://www.usgs.gov/glossary/volcano-hazards-program-glossary)、[NOAA 気象用語集](https://forecast.weather.gov/glossary.php?word=HALO)、[NHGRI 遺伝学用語集](https://www.genome.gov/genetics-glossary/Telomere)、[NCI 医学用語集](https://www.cancer.gov/publications/dictionaries/cancer-terms/def/synapse)、[NCI SEER 神経組織](https://training.seer.cancer.gov/anatomy/nervous/tissue.html)、[CDC プリオン解説](https://www.cdc.gov/prions/about/index.html)、[NIH PubChem](https://pubchem.ncbi.nlm.nih.gov/compound/Morphine)。個別URLと資料が裏付ける内容は JSON の `sources` と各語の `source` / `sourcePath` から追える。

保留7項目は、同義語の正本未整理（アドレナリン／エピネフリン）、別の学術語との混同（コミュニズム）、原語や実在性を確認できない候補など。除外3項目は人物名、神話名、無根拠な略称。別表記統合1項目。各判断と理由は `candidateLedger` に記録した。未確認候補は生成辞書に入れていない。アクシオンは仮説上の粒子と明記する。

## 抽選と検証

分野を先に均等に抽選し、分野内では従来の雰囲気重み上限1.75を使う。最近20件の履歴を避け、候補が足りなければ古い履歴から緩和する。同じバッチの同一表示名・同一 `canonicalTermId` を禁止する。固定seedで物理と天文を6万回抽選した結果、分野は物理29,975、天文30,025。両分野に属するプラズマは2,686回、物理のみのクォークは1,235回。複数所属による約2.2倍の差は設計上残るが、この2分野の試験では極端な集中は見られない。

`node build-science-medical.cjs --check`、`node verify-science-medical.cjs` で、各6分野×2用途の10個生成、お任せ、OR条件、初期OFF、複数タグを模擬した全ON条件、別名統合、履歴、少数・0件、5人モードを確認した。`node verify-science-sources.cjs` は51個の参照URLを機械的に確認し、失敗0。NCI個別語は編集時に照合し、USGSはスクリプトからのアクセスが403になるため公開Web表示で確認した。

Edge の360px実ブラウザで分野選択、キーボード操作、タグ、意味・出典、詳細・名前コピー、保存・再読込、旧保存、候補0件時の結果保持、フル／設定だけ5人を確認した。`reports/v1.6/browser/` に結果と画面を保存した。既存 `verify-ten-names.cjs`、`verify-kanji-myth.cjs`、`verify-naming.cjs`、`verify-expansion.cjs`、`verify.cjs`、`verify-browser-v15.cjs`、`verify-null-name-display.cjs`、`verify-browser.cjs` も通過。旧ブラウザテストの「名前だけ5個」という古い期待値だけ10個へ更新した。

実機スマホ、Safari、Firefox は未確認。候補が10個未満となる現在の単独分野はないため、少数・0件の経路はテスト用に辞書を一時的に縮めて確認した。
