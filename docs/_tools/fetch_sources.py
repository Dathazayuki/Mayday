"""Tải bản chụp mới nhất của tài liệu gốc DrMayDay vào docs/nguon/.

Chạy từ thư mục gốc dự án:  python docs/_tools/fetch_sources.py
Sau đó chạy:                 python docs/_tools/build_docs.py
"""
import datetime
import html
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'docs' / 'nguon'

SHEET_ID = '162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA'
DB_DOC_ID = '1smCGZ0DYY9HXpxjmnyOGg-3Or34GPX-L'
DICT_DOC_ID = '1kGWCfqyb7g1yOBE8qmR4P_u1dLlFqjuB'


def download(url: str, dest: Path) -> bytes:
    with urllib.request.urlopen(url, timeout=60) as resp:
        data = resp.read()
    dest.write_bytes(data)
    print(f'{dest.name}: {len(data) // 1024} KB')
    return data


def decode_tab_name(raw: str) -> str:
    name = re.sub('<[^>]+>', '', raw)
    name = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), name)
    name = re.sub(r'\\x([0-9a-fA-F]{2})', lambda m: chr(int(m.group(1), 16)), name)
    return html.unescape(name.replace('\\/', '/'))


def fetch_tab_names() -> dict:
    """Tên tab thật (có dấu / và :) chỉ lấy được từ trang htmlview, bản xlsx bị cắt tên."""
    url = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/htmlview'
    with urllib.request.urlopen(url, timeout=60) as resp:
        page = resp.read().decode('utf-8', 'ignore')
    pairs = re.findall(r'\{name:\s*"((?:[^"\\]|\\.)*)"[^}]*?gid:\s*"(\d+)"', page)
    return {gid: decode_tab_name(name) for name, gid in pairs}


def main() -> None:
    SRC.mkdir(parents=True, exist_ok=True)
    download(f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=xlsx', SRC / 'api-sheet.xlsx')
    tabs = fetch_tab_names()
    (SRC / 'api-sheet-tabs.json').write_text(json.dumps(tabs, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'api-sheet-tabs.json: {len(tabs)} tab')
    download(f'https://drive.google.com/uc?export=download&id={DB_DOC_ID}', SRC / 'co-so-du-lieu.docx')
    download(f'https://drive.google.com/uc?export=download&id={DICT_DOC_ID}', SRC / 'tu-dien-du-lieu-183-bien.docx')
    (SRC / 'ngay-chup.txt').write_text(datetime.date.today().isoformat() + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
