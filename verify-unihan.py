"""Check the dictionary-reading entries against a supplied Unicode Unihan ZIP.

Usage: python verify-unihan.py path/to/Unihan.zip
The v1.5 review used Unicode 18.0.0, SHA-256
4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e.
"""
import json, zipfile, sys
from pathlib import Path

base=Path(__file__).resolve().parent
if len(sys.argv)!=2:
    raise SystemExit('Usage: python verify-unihan.py path/to/Unihan.zip')
data=json.loads((base/'data'/'kanji-myth-v1.5.json').read_text(encoding='utf-8'))
table={}
with zipfile.ZipFile(sys.argv[1]) as z:
    for line in z.read('Unihan_Readings.txt').decode('utf-8').splitlines():
        if line.startswith('#') or not line:continue
        code,field,value=line.split('\t')
        if field in ('kJapaneseOn','kJapaneseKun'):
            table.setdefault(chr(int(code[2:],16)),set()).update(value.split())

single=dict(zip('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん',
                'A I U E O KA KI KU KE KO SA SHI SU SE SO TA CHI TSU TE TO NA NI NU NE NO HA HI FU HE HO MA MI MU ME MO YA YU YO RA RI RU RE RO WA WO N'.split()))
single.update(dict(zip('がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ',
                       'GA GI GU GE GO ZA JI ZU ZE ZO DA DI DU DE DO BA BI BU BE BO PA PI PU PE PO'.split())))
single.update({'ー':'','ゐ':'WI','ゑ':'WE'})
small={'ゃ':'YA','ゅ':'YU','ょ':'YO'}
def romanize(s):
    out='';i=0
    while i<len(s):
        c=s[i]
        if i+1<len(s) and s[i+1] in small:
            start=single.get(c,'')
            if start in ('SHI','CHI','JI'):
                out+=start[:-1]+small[s[i+1]][1:];i+=2;continue
            if start.endswith('I'):
                out+=start[:-1]+small[s[i+1]];i+=2;continue
        if c=='っ' and i+1<len(s):
            out+=single.get(s[i+1],'')[:1];i+=1;continue
        out+=single.get(c,'?');i+=1
    return out

checked=0;errors=[]
for k in data['kanji']:
    vals=table.get(k['display'],set())
    for reading in k['readings']:
        if reading['kind']=='creative':continue
        r=romanize(reading['text'])
        if r not in vals:
            errors.append((k['display'],reading['text'],r,sorted(vals)))
        checked+=1
if errors:
    for error in errors:print(*error)
    raise SystemExit(f'FAIL: {len(errors)} readings not in Unihan')
print(f'PASS {checked} dictionary readings match Unihan kJapaneseOn/kJapaneseKun')
