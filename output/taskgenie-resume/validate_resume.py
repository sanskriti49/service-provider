from pathlib import Path
import json, re
import pymupdf

root = Path(__file__).resolve().parent
original = (root / 'provided-original.tex').read_text(encoding='utf-8')
final = (root / 'main.tex').read_text(encoding='utf-8')
expected = original.replace('\\resumeItemListEnd\n\\resumeSubHeadingListEnd\n\n% ---------- Projects', '% ---------- Projects')
expected = expected.replace('\\resumeItemListEnd\n\n% ---------- Leadership', '% ---------- Leadership')
start = expected.index('\\resumeItemListStart', expected.index('{TaskGenie --'))
end = expected.index('\\resumeItemListEnd', start)
fstart = final.index('\\resumeItemListStart', final.index('{TaskGenie --'))
fend = final.index('\\resumeItemListEnd', fstart)
expected = expected[:start] + final[fstart:fend] + expected[end:]
expected = expected.replace('\\titlespacing*{\\section}{0pt}{9.5pt}{7pt}', '\\titlespacing*{\\section}{0pt}{2.5pt}{1pt}')
expected = expected.replace('label={},itemsep=2.5pt,topsep=0pt', 'label={},itemsep=1pt,topsep=0pt')
expected = expected.replace('label=\\textbullet,itemsep=1.1pt,topsep=1.5pt', 'label=\\textbullet,itemsep=0.3pt,topsep=1pt')
assert final == expected, 'Unexpected source edit outside authorized text/syntax/spacing changes'
assert final[fstart:fend].count('\\resumeItem{') == 4
assert original[original.index('{Udaan --'):original.index('% ---------- Achievements')] == final[final.index('{Udaan --'):final.index('% ---------- Achievements')]
doc = pymupdf.open(root / 'main.pdf')
assert len(doc) == 1
text = doc[0].get_text()
project = text[text.index('TaskGenie'):text.index('Udaan')]
body = project[project.index('\u2022'):].strip().splitlines()
assert len(body) == 8, body
assert sum(line.startswith('\u2022') for line in body) == 4
assert '\ufffd' not in text
assert all(word in text for word in ['verified', 'finalization', 'reconciliation', 'filtering', 'profile'])
source_links = re.findall(r'\\resumeLink\{([^}]+)\}', final)
pdf_links = [link['uri'] for page in doc for link in page.get_links() if 'uri' in link]
assert sorted(source_links) == sorted(pdf_links), (source_links, pdf_links)
spans = [span for block in doc[0].get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for span in line['spans']]
assert all(s['bbox'][0] >= 24 and s['bbox'][2] <= 588 and s['bbox'][1] >= 10 and s['bbox'][3] <= 767 for s in spans)
report = {'pages': len(doc), 'taskgenie_bullets':4, 'taskgenie_rendered_lines':len(body), 'source_scope_verified':True, 'udaan_source_unchanged':True, 'link_destinations_preserved':len(pdf_links), 'fonts_and_margins_unchanged':True, 'replacement_characters':0, 'small_text_size_pt':min(round(s['size'],3) for s in spans), 'bottom_content_y_pt':max(s['bbox'][3] for s in spans)}
(root / 'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
(root / 'resume-text.txt').write_text(text,encoding='utf-8')
doc[0].get_pixmap(matrix=pymupdf.Matrix(1.5,1.5)).save(root / 'preview.png')
print(json.dumps(report))
