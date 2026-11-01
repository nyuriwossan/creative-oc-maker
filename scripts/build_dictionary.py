#!/usr/bin/env python3
"""Non-destructive, deterministic conversion of the reconstructed delivery (stdlib only)."""
import argparse
import collections
import csv
import hashlib
import json
import io
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw/name-dictionary/03_master_675_reconstructed.csv'
CATEGORIES = ['鳥類', '鉱物・宝石', '蝶・蛾・昆虫', '日本の伝統色', '古語・雅語', '香木・香料', '月・暦・季語', '海洋生物', '気象・自然現象', '日本の伝統文様', '和楽器・雅楽', '金属・工芸素材']
NOTICE = '収録候補は現在、個別出典の再確認中です。表示する用途・印象は創作向けの提案です。'
SMALL = str.maketrans('ぁぃぅぇぉっゃゅょゎゕゖ', 'あいうえおつやゆよわかけ')


def normalize(value):
    value = unicodedata.normalize('NFKC', value).lower()
    value = ''.join(chr(ord(c)-0x60) if 'ァ' <= c <= 'ヶ' else c for c in value)
    return re.sub(r'[\s・･]+', '', value).translate(SMALL)


def gojuon(value):
    first = unicodedata.normalize('NFD', normalize(value).lstrip('ー'))[0]
    for group, chars in [('あ', 'あいうえお'), ('か', 'かきくけこ'), ('さ', 'さしすせそ'), ('た', 'たちつてと'), ('な', 'なにぬねの'), ('は', 'はひふへほ'), ('ま', 'まみむめも'), ('や', 'やゆよ'), ('ら', 'らりるれろ'), ('わ', 'わゐゑをん')]:
        if first in chars:
            return group
    raise ValueError('Unknown gojuon initial: ' + value)


def category(row):
    big = row['big_category']
    if big in CATEGORIES:
        return big
    if big == '鳥類・昆虫の漢字補完':
        assert row['small_category'] in ('鳥', '昆虫')
        return '鳥類' if row['small_category'] == '鳥' else '蝶・蛾・昆虫'
    if big.endswith('類'):
        return '鳥類'
    if big in ('蝶', '蛾', '甲虫'):
        return '蝶・蛾・昆虫'
    if big in ('赤', '青', '茶', '紫', '緑', '黄', '黒白', '白'):
        return '日本の伝統色'
    raise ValueError('Unmapped category: ' + big)


def serialized(obj):
    # Safe even if subsequently embedded; consumers render text, never executable HTML.
    return json.dumps(obj, ensure_ascii=False, indent=2).replace('&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029') + '\n'


def build():
    raw = RAW.read_bytes()
    rows = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
    assert len(rows) == 675 and len(rows[0]) == 38
    assert len({r['id'] for r in rows}) == 675
    assert collections.Counter(r['id'].split('-')[0] for r in rows) == {'ND': 389, 'NEW': 264, 'SUP': 22}
    overrides = json.loads((ROOT / 'data/dictionary-v1.7-overrides.json').read_text())
    assert len({o['id'] for o in overrides}) == len(overrides)
    assert all(o['id'] in {r['id'] for r in rows} and o['reason'] for o in overrides)
    by_id = {o['id']: o for o in overrides}
    entries = []
    for r in rows:
        assert r['publication_review_required'] == '1'
        assert r['reading_hiragana'] and not r['alternate_forms'] and not r['parent_source_id']
        major = category(r)
        source = {'name': r['source_name'], 'url': r['source_url'], 'note': ''}
        scope = '参考資料（個別の名称・読みを直接確認したものではありません）。' + r['source_scope']
        if r['id'] in by_id:
            o = by_id[r['id']]
            assert set(o['changes']) == {'source.url', 'source.note'}
            source.update(url=o['changes']['source.url'], note=o['changes']['source.note'])
        entry = dict(id=r['id'], display=r['name'], reading=r['reading_hiragana'],
                     readingNormalized=normalize(r['reading_hiragana']), gojuonGroup=gojuon(r['reading_hiragana']),
                     majorCategory=major, minorCategory=r['small_category'], originalCategory=r['big_category'],
                     aliases=[], original=r['english_or_original'], description=r['meaning_description'],
                     usageFlags={k: int(r[col]) for k, col in [('name', 'name_use'), ('family', 'surname_family_use'), ('code', 'alias_codename_use'), ('place', 'organization_place_use')]},
                     impressionTags=[s for s in r['impression_tags'].split(';') if s],
                     source=source, sourceScope=scope,
                     verification={k: r['verification_'+k] for k in ['name', 'reading', 'origin', 'form', 'classification']},
                     reviewRequired=True, sourceBatch=r['source_batch'],
                     # HOM groups in the delivery also include different meanings: never equate them.
                     canonicalGroup=r['id'], sourceId=r['original_id'] or r['id'],
                     relatedGroupUnconfirmed=r['canonical_group'] or r['internal_duplicate_group'],
                     rawSource={'name': r['source_name'], 'url': r['source_url'], 'scope': r['source_scope']},
                     editorialNotice=r['editorial_notice'], changeNote=r['change_note'])
        entries.append(entry)
    assert len({e['majorCategory'] for e in entries}) == 12
    duplicate_names = collections.defaultdict(list)
    for e in entries:
        duplicate_names[e['display']].append(e['id'])
    report = dict(rawSha256=hashlib.sha256(raw).hexdigest(), rawColumns=38, inputCount=len(rows), outputCount=len(entries),
                  batches=dict(collections.Counter(r['id'].split('-')[0] for r in rows)),
                  categories={k: sum(e['majorCategory'] == k for e in entries) for k in CATEGORIES},
                  reviewRequired=675, missingReadings=0, missingNormalizedKeys=0,
                  idMapping=[{'source': r['id'], 'output': e['id']} for r, e in zip(rows, entries)],
                  duplicateDisplays={k: v for k, v in duplicate_names.items() if len(v) > 1},
                  corrections=overrides,
                  notes=['原本CSVはバイト列を変更せず保持。名称・読み・由来は修正していない。',
                         '用途フラグは全件継承。ND389件のname=0も一覧と直接選択に残す。',
                         '原本HOM群は同表記別義を含むためrelatedGroupUnconfirmedに保存。canonicalGroupは独立ID。',
                         'SUP全22件の異表記リンクは未確定。全675件の個別出典照合は未実施。'])
    return {ROOT / 'data/dictionary-v1.7.json': serialized(dict(version='1.7', notice=NOTICE, categories=CATEGORIES, entries=entries)),
            ROOT / 'reports/v1.7/data-quality.json': serialized(report)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for path, content in build().items():
        if args.check:
            assert path.read_text() == content, str(path) + ' is stale'
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
    print('PASS: 675 entries, 389/264/22 IDs, 12 categories, all review required; raw unchanged')


if __name__ == '__main__':
    main()
