"""Rebuild the source excerpts from the existing roadmap; never imports the resume."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = ROOT.parent / 'roadmap' / 'guide_text.txt'
text = source.read_text(encoding='utf-8')
weeks = []
for week in range(1, 5):
    match = re.search(rf'Week {week:02d} \| (.*?)\nLearn: (.*?)\nProduce: (.*?)(?=\nWeek |\nMove forward when:)', text, re.S)
    if not match:
        raise ValueError(f'Week {week} was not found in {source}')
    title, learn, produce = [' '.join(value.split()) for value in match.groups()]
    weeks.append({'week': week, 'title': title, 'learn': learn, 'deliverable': produce,
                  'source': 'Career Roadmap · page 5', 'source_id': f'roadmap-w{week}',
                  'source_path': 'roadmap/guide_text.txt'})
(ROOT / 'data' / 'roadmap.json').write_text(json.dumps(weeks, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(f'Imported {len(weeks)} weeks from roadmap page 5.')
