# 創作OCメーカー・名前辞典 再構成一括納品

**重要：これはDeep Research本来の一括ZIPの再取得品ではなく、手元に残った389件の原本と調査レポートから作成した再構成版です。**

- 既存389件：元のIDを保持、明示されていた2件の読み誤りを修正。元出典と分類を継承。個別原典への再アクセスは未実施。
- 新規264件：8分野×32～40件、名称・読み・個別の短い説明・分野別参考URL・創作用途・印象タグ。分野別参考ページは**個別すべての語の直接根拠ではありません**。
- 漢字候補22件：鳥・昆虫の表記候補。個別の国語辞典・専門辞書による書字照合が必要。
- 合計675件。CSVはUTF-8 BOM付き（UTF-8-sig）です。Pythonなどでは `encoding="utf-8-sig"` で読み込んでください。
- 全行で `publication_review_required=1`。公開用データに使う前に専門資料で確認してください。
- CSVの用途フラグ・印象タグは**創作上の編集判断**であり、人名の実在証明ではありません。
- 付属の `00_previous_deep_research_report.md` は先行調査の報告書本文です。報告書で記載された詳細な調査結果と、この再構成ZIPの検証達成度は**同じではありません**。

## 重要なファイル
`03_master_675_reconstructed.csv`：統合マスター。`01_existing_389_reconstructed.csv`：既存分。`02_new_8genres_264.csv`：追加候補。`02b_bird_insect_kanji_22.csv`：表記候補。`04b_unconfirmed_fields.csv`：検証課題。`05b_duplicate_details.csv`：重複の個別照合。`07_dictionary_ui_design.md`：検索・分類案。`00_manus_original_delivery.zip`：受領原本。
