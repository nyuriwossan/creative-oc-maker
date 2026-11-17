#!/usr/bin/env python3
"""「言葉から名付け」用データを組み立てる。
  data/word-naming-v1.json … v2.1 の第1段階（20語）。互換性のためそのまま残す。
  data/word-naming-v2.json … v2.2 の第2段階（11カテゴリ）。画面が読み込むのはこちら。
v2 で追加した語は scripts/word_naming_words_v2.py にある。
既存の名前辞典データ（data/dictionary-v1.7.json）とは別スキーマ・別ファイル。
語義は各辞書の見出しページで確認し、説明は短く編集した日本語で書く（辞書本文は転載しない）。
  python scripts/build_word_naming.py          # 書き出す
  python scripts/build_word_naming.py --check  # 生成物が最新か確認する
"""
import json, sys, pathlib

CHECKED = "2026-11-17"
LANGS = {
    "fr": {"label": "フランス語", "dictionary": "Larousse", "host": "www.larousse.fr"},
    "de": {"label": "ドイツ語", "dictionary": "Duden", "host": "www.duden.de"},
    "it": {"label": "イタリア語", "dictionary": "Treccani", "host": "www.treccani.it"},
    "en": {"label": "英語", "dictionary": "Cambridge Dictionary", "host": "dictionary.cambridge.org"},
    "pt": {"label": "ポルトガル語", "dictionary": "Priberam", "host": "dicionario.priberam.org"},
}
CATEGORIES = [
    {"id": "affirm", "label": "肯定・同意", "status": "available",
     "aliases": ["はい", "賛成", "同意", "うなずく", "承諾", "了承", "肯定", "合意", "一致", "イエス", "ok", "オーケー"]},
    {"id": "recognize", "label": "承認・認知", "status": "available",
     "aliases": ["認める", "承認", "認知", "評価", "称賛", "ほめる", "褒める", "敬意", "認められる", "感謝"]},
] + [{"id": i, "label": l, "status": "planned", "aliases": []} for i, l in [
    ("accept", "受容・寛容"), ("harmony", "調和・平和"), ("hope", "希望・未来"), ("bless", "祝福・幸福"),
    ("trust", "信頼・誠実"), ("love", "慈愛・優しさ"), ("courage", "勇気・意志"), ("freedom", "自由・解放"), ("thanks", "感謝・称賛")]]
NUANCES = {"everyday": "日常的", "formal": "あらたまった", "official": "公的・手続き", "praise": "称賛を含む",
           "harmony": "調和を含む", "gratitude": "感謝を含む", "polysemy": "多義語（別の意味に注意）"}
METHODS = {"kana": "原語の響きを参考にしたカタカナ化", "short": "短縮形", "adjust": "読みやすさのための音の調整", "free": "自由編集"}
IMPRESSIONS = {"soft": "やわらかい", "crisp": "凛とした", "bright": "明るい", "calm": "落ち着いた", "noble": "気品のある", "strong": "力強い"}

# (id, 原語, 品詞, 意味, カテゴリ, ニュアンス, 注意点, IPA or None, 発音メモ, カタカナ, URL, 検索語, 候補[(名前, 方法, 印象タグ, 創作名としての印象)])
W = [
 ("WN-FR-0001", "oui", "fr", "副詞", "問いかけに肯定で答える語。「はい」。賛成や承認の表明にも使う。", ["affirm"], ["everyday"],
  "日常のもっとも基本的な返事。名詞として「賛成（の返事・票）」の意味でも使う。", "wi", "", "ウィ",
  "https://www.larousse.fr/dictionnaires/francais/oui/56881", ["はい", "返事", "賛成"],
  [("ウィ", "kana", ["soft", "bright"], "一音で軽やか。愛称や妖精のような小さな存在に。"),
   ("ウィア", "adjust", ["soft", "bright"], "語尾に母音を足して名前らしくした形。明るく親しみやすい。"),
   ("ウィエル", "adjust", ["noble", "soft"], "語尾を伸ばして響きを整えた形。澄んだ印象。")]),
 ("WN-FR-0002", "accord", "fr", "名詞（男性）", "人や集団のあいだの一致・調和。また同意や許可、取り決め・協定。", ["affirm"], ["harmony", "polysemy"],
  "音楽の「和音」、文法の「一致」の意味もある多義語。", "akɔr", "", "アコール",
  "https://www.larousse.fr/dictionnaires/francais/accord/479", ["一致", "調和", "協定", "和音"],
  [("アコール", "kana", ["calm", "noble"], "伸びやかで落ち着いた響き。調停役や楽師に。"),
   ("コール", "short", ["crisp"], "前半を落とした短い形。呼びやすく凛とする。"),
   ("アコル", "adjust", ["crisp", "strong"], "長音を詰めて引き締めた形。")]),
 ("WN-FR-0003", "assentiment", "fr", "名詞（男性）", "他者の考えや提案に賛同を示すこと。同意、承認。", ["affirm", "recognize"], ["formal"],
  "あらたまった語。うなずきなど、態度で示す同意にも使う。", "asɑ̃timɑ̃", "", "アサンティマン",
  "https://www.larousse.fr/dictionnaires/francais/assentiment/5798", ["賛同", "同意", "うなずき"],
  [("アサンティマン", "kana", ["noble", "calm"], "長く優雅な響き。称号や家名向き。"),
   ("サンティ", "short", ["soft", "bright"], "中ほどを取り出した形。軽く愛らしい。"),
   ("アサント", "adjust", ["crisp"], "後半を畳んで短く整えた形。")]),
 ("WN-FR-0004", "reconnaissance", "fr", "名詞（女性）", "真実・価値・正当性を認めること。また、恩を受けた相手への感謝の気持ち。", ["recognize"], ["gratitude", "polysemy"],
  "多義語。「見分けること」「偵察」「罪を認めること」の意味もあり、文脈で印象が変わる。", "rəkɔnesɑ̃s", "", "ルコネサンス",
  "https://www.larousse.fr/dictionnaires/francais/reconnaissance/67116", ["認める", "感謝", "承認"],
  [("ルコネサンス", "kana", ["noble"], "格調のある長い響き。組織名や称号に。"),
   ("ルコネ", "short", ["soft", "calm"], "前半だけを取った形。丸くやさしい。"),
   ("ネサン", "short", ["crisp"], "後半を取った形。短く引き締まる。"),
   ("コネッサ", "adjust", ["bright", "strong"], "音を入れ替えて女性名風に整えた形。")]),
 ("WN-DE-0001", "ja", "de", "不変化詞", "決定疑問に肯定で答える語。「はい」。強調や念押しの働きもする。", ["affirm"], ["everyday"],
  "日常語。文の途中では「たしかに」「〜だよね」のような調子を添える語としても使う。", "jaː", "", "ヤー",
  "https://www.duden.de/rechtschreibung/ja", ["はい", "返事", "賛成"],
  [("ヤー", "kana", ["bright", "strong"], "短く力強い一声。豪快な人物の愛称に。"),
   ("ヤーレ", "adjust", ["bright"], "語尾を足して名前らしくした形。"),
   ("ヤア", "adjust", ["soft"], "長音を母音に開いた形。やわらかく幼い印象。")]),
 ("WN-DE-0002", "Zustimmung", "de", "名詞（女性）", "賛成すること。同意、了承。", ["affirm"], ["official"],
  "個人の賛同から、議会や保護者の正式な同意まで広く使う。", "ˈtsuːʃtɪmʊŋ", "", "ツーシュティムング",
  "https://www.duden.de/rechtschreibung/Zustimmung", ["賛成", "同意", "了承"],
  [("ツーシュティムング", "kana", ["strong"], "重厚で硬質な響き。制度や組織の名に。"),
   ("シュティム", "short", ["crisp", "strong"], "中心部を取り出した形。鋭く短い。"),
   ("ティムング", "short", ["calm"], "後半を取った形。")]),
 ("WN-DE-0003", "Anerkennung", "de", "名詞（女性）", "価値や功績を認めること。評価、称賛、敬意。また公的な承認。", ["recognize"], ["praise", "official"],
  "「称賛・敬意」と「（国家などの）公式な承認」の二つの軸がある。", None, "Dudenで確認できたのは強勢の位置（語頭）まで。発音記号は未確認。", "アンエアケヌング",
  "https://www.duden.de/rechtschreibung/Anerkennung", ["評価", "称賛", "敬意", "承認"],
  [("アネルケン", "adjust", ["noble", "strong"], "音をなめらかにつないだ形。騎士や家名に。"),
   ("アネル", "short", ["soft", "noble"], "前半を取った形。やわらかく上品。"),
   ("ケヌン", "short", ["crisp"], "後半を取った形。")]),
 ("WN-DE-0004", "Beifall", "de", "名詞（男性）", "拍手や歓声で示す賛意、喝采。また賛成、同意。", ["affirm", "recognize"], ["praise"],
  "第一義は「拍手喝采」。意見が賛同を得る、という使い方もする。", None, "発音記号は未確認。", "バイファル",
  "https://www.duden.de/rechtschreibung/Beifall", ["拍手", "喝采", "賛成"],
  [("バイファル", "kana", ["strong", "bright"], "張りのある響き。舞台人や英雄に。"),
   ("ファル", "short", ["crisp"], "後半を取った短い形。"),
   ("バイファ", "short", ["bright"], "語尾を落とした形。軽快。")]),
 ("WN-IT-0001", "sì", "it", "副詞", "肯定の返事「はい」。", ["affirm"], ["everyday"],
  "古い・文語的な用法では「このように」の意味。アクセント記号のない si は別の語（再帰代名詞）。", None, "発音記号は未確認。", "シ",
  "https://www.treccani.it/vocabolario/si/", ["はい", "返事", "賛成"],
  [("シ", "kana", ["soft"], "一音の名。静かで控えめ。"),
   ("シーア", "adjust", ["soft", "bright"], "伸ばして母音を足した形。澄んだ響き。"),
   ("シエラ", "adjust", ["noble", "bright"], "語尾を足して名前らしくした形。")]),
 ("WN-IT-0002", "assenso", "it", "名詞（男性）", "賛成すること、承認。それを示す言葉やしぐさ。", ["affirm", "recognize"], ["formal"],
  "哲学では、ある観念を真と認めて受け入れる心の働きを指す。", "a's:ɛnso", "Treccani「Sinonimi e Contrari」の表記。", "アッセンソ",
  "https://www.treccani.it/vocabolario/assenso/", ["賛成", "承認", "同意"],
  [("アッセンソ", "kana", ["strong", "noble"], "弾むような力のある響き。"),
   ("センソ", "short", ["calm"], "後半を取った形。落ち着いた印象。"),
   ("アセン", "adjust", ["crisp"], "促音を外して短くした形。")]),
 ("WN-IT-0003", "consenso", "it", "名詞（男性）", "意志や意見の一致。また同意・許可、好意的な評価。", ["affirm"], ["official", "harmony"],
  "法律・医療・政治など公的な文脈でよく使う（契約の合意、説明を受けたうえでの同意、支持など）。", "kon'sɛnso", "Treccani「Sinonimi e Contrari」の表記。", "コンセンソ",
  "https://www.treccani.it/vocabolario/consenso/", ["合意", "一致", "同意", "支持"],
  [("コンセンソ", "kana", ["calm", "noble"], "まとまりのある響き。評議会や同盟の名に。"),
   ("コンセ", "short", ["bright", "soft"], "前半を取った形。親しみやすい。"),
   ("コセン", "adjust", ["crisp"], "撥音をひとつ外して引き締めた形。")]),
 ("WN-IT-0004", "riconoscimento", "it", "名詞（男性）", "認めること、認められること。識別・確認、権利や価値の承認。", ["recognize"], ["official", "praise", "polysemy"],
  "第一義は「人や物を見分けること」。功績への報い、表彰の意味でも使う。", "rikonoʃi'mento", "Treccani「Sinonimi e Contrari」の表記。", "リコノシメント",
  "https://www.treccani.it/vocabolario/riconoscimento/", ["認める", "承認", "表彰", "識別"],
  [("リコノシメント", "kana", ["noble"], "長く流れる響き。儀式や称号に。"),
   ("リコノ", "short", ["soft", "bright"], "前半を取った形。軽く呼びやすい。"),
   ("ノシメ", "short", ["calm"], "中ほどを取った形。和風にも寄せられる。"),
   ("リコーノ", "adjust", ["bright", "noble"], "長音を入れて伸びやかにした形。")]),
 ("WN-EN-0001", "yes", "en", "副詞", "同意や承諾を表す語。「はい」。", ["affirm"], ["everyday"],
  "日常語。くだけた形に yeah などがある。", "jes", "", "イェス",
  "https://dictionary.cambridge.org/dictionary/english/yes", ["はい", "返事", "賛成"],
  [("イェス", "kana", ["bright", "crisp"], "短く明るい。表記「イエス」は別の固有名（キリスト）と重なるので避けた。"),
   ("イェシア", "adjust", ["soft", "bright"], "語尾に母音を足して名前らしくした形。"),
   ("エス", "short", ["crisp"], "頭の半母音を落とした形。記号的で無機質な印象にもなる。")]),
 ("WN-EN-0002", "assent", "en", "名詞・動詞", "考え・計画・要請に対する正式な同意、承認。", ["affirm", "recognize"], ["formal", "official"],
  "フォーマルな語。英国では法案への国王の裁可（Royal Assent）にも使う。", "əˈsent", "", "アセント",
  "https://dictionary.cambridge.org/dictionary/english/assent", ["同意", "承認", "裁可"],
  [("アセント", "kana", ["crisp", "noble"], "端正な響き。書記官や審判役に。"),
   ("アセン", "short", ["crisp"], "語尾を落とした形。"),
   ("セント", "short", ["calm"], "後半を取った形。別の英単語を連想させやすい点に注意。")]),
 ("WN-EN-0003", "accord", "en", "名詞・動詞", "（正式な）合意、協定。意見などの一致。", ["affirm"], ["formal", "harmony"],
  "of one's own accord で「自発的に」。動詞では敬意や待遇を「与える」意味のフォーマルな語。", "əˈkɔːd", "英国式の発音。", "アコード",
  "https://dictionary.cambridge.org/dictionary/english/accord", ["合意", "協定", "一致"],
  [("アコード", "kana", ["calm", "strong"], "安定した響き。同名の商品名が広く知られている点に注意。"),
   ("コード", "short", ["crisp"], "後半を取った形。別の英単語（code／cord）を連想させやすい。"),
   ("アコー", "short", ["soft"], "語尾を落とした形。")]),
 ("WN-EN-0004", "acknowledgment", "en", "名詞", "何かが事実である・正しいと認めること。また感謝のしるし、受け取りの知らせ。", ["recognize"], ["gratitude", "polysemy"],
  "綴りは acknowledgement とも書く。複数形は本の「謝辞」を指す。", "əkˈnɒlɪdʒmənt", "英国式の発音。", "アクノリッジメント",
  "https://dictionary.cambridge.org/dictionary/english/acknowledgment", ["認める", "謝辞", "感謝", "承認"],
  [("アクノリッジ", "short", ["noble", "strong"], "語尾を落とした形。学者や記録官に。"),
   ("ノリッジ", "short", ["calm"], "中ほどを取った形。地名風にも使える。"),
   ("アクノ", "short", ["crisp"], "前半を取った形。"),
   ("リッジ", "short", ["crisp", "strong"], "強く響く部分を取った形。別の英単語（ridge）と重なる。")]),
 ("WN-PT-0001", "sim", "pt", "副詞・名詞（男性）", "肯定・同意・承諾を表す語。「はい」。", ["affirm"], ["everyday"],
  "名詞として「承諾（の返事）」。dar o sim で「承諾する」。", None, "発音記号は未確認。語末は鼻にかかる音で、カタカナでは近似にとどまる。", "シン",
  "https://dicionario.priberam.org/pt-pt/sim", ["はい", "返事", "承諾"],
  [("シン", "kana", ["calm", "crisp"], "短く静かな名。和名にも洋名にも寄せられる。"),
   ("シムア", "adjust", ["soft"], "綴りの m を生かして母音を足した形。"),
   ("シンエ", "adjust", ["soft", "bright"], "語尾に母音を足した形。")]),
 ("WN-PT-0002", "acordo", "pt", "名詞（男性）", "人や物事のあいだの調和。取り決め・協定。許可、同意。", ["affirm"], ["harmony", "polysemy"],
  "「分別・思慮」の意味もある。同じ綴りが動詞 acordar（目を覚ます／合意する）の活用形にもなる。", None, "Priberamで確認できたのは「co」の母音が閉じた音であることまで。", "アコルド",
  "https://dicionario.priberam.org/pt-pt/acordo", ["調和", "協定", "同意", "合意"],
  [("アコルド", "kana", ["calm", "strong"], "落ち着いた重みのある響き。"),
   ("コルド", "short", ["crisp", "strong"], "後半を取った形。"),
   ("アコル", "short", ["crisp"], "語尾を落とした形。")]),
 ("WN-PT-0003", "assentimento", "pt", "名詞（男性）", "同意すること。承諾、賛成。", ["affirm", "recognize"], ["formal"],
  "動詞 assentir（納得して、または自分の意志で同意する）から。", None, "発音記号は未確認。", "アセンティメント",
  "https://dicionario.priberam.org/pt-pt/assentimento", ["同意", "承諾", "賛成"],
  [("アセンティメント", "kana", ["noble"], "長く丁寧な響き。儀礼や誓約の名に。"),
   ("センティ", "short", ["soft", "bright"], "中ほどを取った形。"),
   ("ティメント", "short", ["calm"], "後半を取った形。")]),
 ("WN-PT-0004", "reconhecimento", "pt", "名詞（男性）", "認めること。事実を認める表明、感謝の気持ち、報いや褒賞。", ["recognize"], ["gratitude", "praise", "polysemy"],
  "「綿密な調査」、軍事の「偵察」の意味もある。", None, "発音記号は未確認。", "レコニェシメント",
  "https://dicionario.priberam.org/reconhecimento", ["認める", "感謝", "褒賞", "承認"],
  [("レコニェ", "short", ["soft"], "前半を取った形。やわらかく異国風。"),
   ("ニェシ", "short", ["soft", "bright"], "中ほどを取った形。小さく愛らしい。"),
   ("レコニ", "adjust", ["crisp"], "拗音を外して読みやすくした形。")]),
]

def build():
    words = []
    for (wid, lemma, lang, pos, meaning, cats, nuances, note, ipa, pnote, kana, url, tags, cands) in W:
        words.append({
            "id": wid, "lemma": lemma, "lang": lang, "pos": pos, "meaningJa": meaning,
            "categories": cats, "nuances": nuances, "nuanceNote": note,
            "pronunciation": {"ipa": ipa, "note": pnote},
            "kana": {"text": kana, "basis": "ipa" if ipa else "unconfirmed"},
            "source": {"dictionary": LANGS[lang]["dictionary"], "url": url},
            "verification": {"status": "verified", "date": CHECKED, "scope": "見出し語の表記・品詞・語義を辞書の見出しページで確認"},
            "tags": tags,
            "candidates": [{"id": "%s-%s" % (wid, "abcdefgh"[i]), "name": n, "method": m, "impressions": imp, "note": nt}
                           for i, (n, m, imp, nt) in enumerate(cands)],
        })
    return {"schema": "oc-word-naming", "schemaVersion": 1, "dataVersion": "1.0.0", "stage": 1,
            "theme": "ポジティブな意味の言葉",
            "notice": "原語の意味は辞書で確認した内容を短く編集したものです。創作名は原語を加工した造語で、原語に実在する人名・単語であることを示しません。",
            "languages": LANGS, "categories": CATEGORIES, "nuances": NUANCES, "methods": METHODS, "impressions": IMPRESSIONS, "words": words}

# ---------------------------------------------------------------- v2（第2段階）
CATEGORIES_V2 = [
    {"id": "affirm", "label": "肯定・同意", "aliases": CATEGORIES[0]["aliases"]},
    {"id": "recognize", "label": "承認・認知", "aliases": CATEGORIES[1]["aliases"]},
    {"id": "accept", "label": "受容・寛容", "aliases": ["受け入れる", "寛大", "許す", "赦す", "許し", "赦し", "包容", "歓迎", "迎える", "もてなし"]},
    {"id": "harmony", "label": "調和・平和", "aliases": ["平穏", "安らぎ", "穏やか", "協調", "和合", "静けさ", "落ち着き", "ハーモニー", "ピース", "和解"]},
    {"id": "hope", "label": "希望・未来", "aliases": ["将来", "望み", "期待", "夜明け", "朝焼け", "楽観", "抱負", "始まり", "ホープ"]},
    {"id": "bless", "label": "祝福・幸福", "aliases": ["幸せ", "しあわせ", "喜び", "歓喜", "至福", "幸運", "恵み", "祝う", "ハッピー"]},
    {"id": "trust", "label": "信頼・誠実", "aliases": ["正直", "忠実", "忠誠", "信じる", "信義", "率直", "真心", "信仰", "約束"]},
    {"id": "love", "label": "慈愛・優しさ", "aliases": ["やさしさ", "優しい", "やさしい", "愛情", "思いやり", "慈悲", "親切", "いたわり", "慈しみ", "善意"]},
    {"id": "courage", "label": "勇気・意志", "aliases": ["勇敢", "大胆", "決意", "武勇", "度胸", "不屈", "果敢", "勇ましい", "気概"]},
    {"id": "freedom", "label": "自由・解放", "aliases": ["独立", "自立", "救い", "救済", "解き放つ", "自主", "フリーダム"]},
    {"id": "thanks", "label": "感謝・称賛", "aliases": ["ありがとう", "お礼", "賛辞", "賛美", "たたえる", "讃える", "名誉", "敬意", "ほめる", "褒める", "謝意"]},
]
for c in CATEGORIES_V2:
    c["status"] = "available"
NUANCES_V2 = dict(NUANCES, literary="文語・雅語", religious="宗教的な意味を含む")
IMPRESSIONS_V2 = dict(IMPRESSIONS, elegant="優雅な")
ACCESS = {"search-excerpt": "辞書サイトに限定した検索で見出しページを特定し、検索結果に表示されたページ抜粋で確認（ページを直接開いての全文確認ではない）"}
SCOPE_V2 = "見出し語の表記・品詞・語義の冒頭"
# v2.1 の20語に、v2 で使えるようになったカテゴリを足す（ID・語義・候補は変更しない）
EXTRA_CATS = {"WN-FR-0002": ["harmony"], "WN-FR-0004": ["thanks"], "WN-DE-0003": ["thanks"], "WN-DE-0004": ["thanks"],
              "WN-IT-0003": ["harmony"], "WN-IT-0004": ["thanks"], "WN-EN-0003": ["harmony"], "WN-EN-0004": ["thanks"],
              "WN-PT-0002": ["harmony"], "WN-PT-0004": ["thanks"]}
# v2.1 の候補のうち、実在の語・名称との重なりが分かっているもの
OVERLAP_V1 = {"コール": "外来語「コール」と同じ表記", "アコード": "商品名として広く知られている", "コード": "外来語「コード」と同じ表記",
              "セント": "外来語「セント」と同じ表記", "リッジ": "英語 ridge と同じ読み", "シン": "日本語の人名・語と同音",
              "エス": "アルファベットの S と同じ読み", "ノリッジ": "英国の都市ノリッジ（Norwich）と同じ表記", "シエラ": "スペイン語 sierra（山脈）・実在の人名と同じ表記",
              "ファル": "", "アセント": "英語 ascent（上昇）のカタカナ表記とも同じ", "コンセ": "", "ヤー": "ドイツ語の返事として知られる"}

def word_v2(wid, lemma, lang, pos, meaning, cats, nuances, note, ipa, pnote, kana, url, tags, cands, scope_note, v1=False):
    scope = SCOPE_V2 + ("。" + scope_note if scope_note else "")
    return {
        "id": wid, "lemma": lemma, "lang": lang, "pos": pos, "meaningJa": meaning,
        "categories": cats + ([c for c in EXTRA_CATS.get(wid, []) if c not in cats] if v1 else []),
        "nuances": nuances, "nuanceNote": note,
        "pronunciation": {"ipa": ipa, "note": pnote},
        "kana": {"text": kana, "basis": "ipa" if ipa else "unconfirmed"},
        "source": {"dictionary": LANGS[lang]["dictionary"], "url": url},
        "verification": {"status": "verified", "date": CHECKED, "access": "search-excerpt", "scope": scope},
        "tags": tags, "since": "2.1" if v1 else "2.2",
        "candidates": [{"id": "%s-%s" % (wid, "abcdefgh"[i]), "name": c[0], "method": c[1], "impressions": c[2], "note": c[3],
                        "overlap": (OVERLAP_V1.get(c[0], "") if v1 else c[4])} for i, c in enumerate(cands)],
    }

def build_v2():
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    from word_naming_words_v2 import NEW
    words = [word_v2(*w, None, v1=True) for w in W] + [word_v2(*w) for w in NEW]
    return {"schema": "oc-word-naming", "schemaVersion": 2, "dataVersion": "2.0.0", "stage": 2,
            "theme": "ポジティブな意味の言葉",
            "notice": "原語の意味は、辞書で確認した内容を短く編集したものです。創作名は原語をもとに創作向けに加工した候補で、実在する人名・単語との重複は確認していません。",
            "languages": LANGS, "categories": CATEGORIES_V2, "nuances": NUANCES_V2, "methods": METHODS,
            "impressions": IMPRESSIONS_V2, "access": ACCESS, "words": words}

def main():
    root = pathlib.Path(__file__).resolve().parent.parent / "data"
    targets = [(root / "word-naming-v1.json", build()), (root / "word-naming-v2.json", build_v2())]
    stale = False
    for out, data in targets:
        text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
        if "--check" in sys.argv:
            if not out.exists() or out.read_text(encoding="utf8") != text:
                print("%s is stale; run scripts/build_word_naming.py" % out.name); stale = True
        else:
            out.write_text(text, encoding="utf8"); print("wrote %s (%d words)" % (out.name, len(data["words"])))
    if "--check" in sys.argv:
        if stale: sys.exit(1)
        print("word-naming data is up to date (%s)" % ", ".join("%s: %d words" % (o.name, len(d["words"])) for o, d in targets))

if __name__ == "__main__":
    main()
