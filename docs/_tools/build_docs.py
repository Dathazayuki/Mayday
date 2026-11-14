"""Sinh bộ tài liệu chuẩn DrMayDay (docs/*.md) từ bản chụp tài liệu gốc.

Chạy từ thư mục gốc dự án:  python docs/_tools/build_docs.py
Đầu vào:  tai-lieu-goc/SLIDE*_DrMayDay.pptx, docs/nguon/* (lấy bằng fetch_sources.py)
Đầu ra:   docs/01-tong-quan-yeu-cau.md, docs/02-api/*.md, docs/03-co-so-du-lieu.md,
          docs/04-tu-dien-du-lieu-183-bien.md, docs/06-ke-hoach-tuan-va-api-cu.md

Các file đầu ra là bản sinh tự động: muốn sửa nội dung thì sửa tài liệu gốc rồi chạy lại.
"""
import json
import re
from pathlib import Path

import docx
import openpyxl
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / 'docs'
SRC = DOCS / 'nguon'
SLIDES = ROOT / 'tai-lieu-goc'
API_DIR = DOCS / '02-api'

SHEET_ID = '162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA'
SHEET_TAB_URL = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit#gid={{gid}}'
DB_DOC_URL = 'https://docs.google.com/document/d/1smCGZ0DYY9HXpxjmnyOGg-3Or34GPX-L'
DICT_DOC_URL = 'https://docs.google.com/document/d/1kGWCfqyb7g1yOBE8qmR4P_u1dLlFqjuB'
SNAPSHOT = (SRC / 'ngay-chup.txt').read_text(encoding='utf-8').strip()
IMAGE_MIN_BYTES = 15000  # ảnh nhỏ hơn là logo/trang trí, không phải ảnh bảng API

# deck -> (tên file, tiêu đề phần). Deck 1 là tổng quan, xử lý riêng.
MODULES = {
    2: '01-xac-thuc-tai-khoan',
    3: '02-quan-tri-nguoi-dung-phan-quyen',
    4: '03-co-so-vat-chat',
    5: '04-benh-nhan-benh-an',
    6: '05-uas7',
    7: '06-don-thuoc-xet-nghiem',
    8: '07-kho-anh-tep-dinh-kem',
    9: '08-ton-thuong-da',
    10: '09-thong-bao',
    11: '10-mau-phieu-kham-dong',
    12: '11-ai-du-doan-anh',
}
AI_MODULE_TITLE = 'Phần bổ sung: AI dự đoán ảnh (chỉ có trong Sheet, không có slide)'

# Tab Sheet không được slide nào trỏ tới -> gán vào phần tương ứng.
EXTRA_TAB_MODULE = {
    '1429025238': 5,   # POST /api/medical_records/:id/answers
    '1207316828': 5,   # PATCH /api/medical_records/:id/status
    '1548845498': 6,   # GET /api/uas7-scores/week/:patientId
    '1290012571': 8,   # POST /api/image-attachments/upload-multiple
    '1389510992': 8,   # GET /api/image-attachments/view/:id
    '1481261433': 8,   # POST /api/answer-images/bulk
    '1269227558': 9,   # GET /api/lesion-episodes/record/:medical_record_id
    '1202201005': 12,  # POST /api/ai/predict/image
}

# Slide có ảnh bảng API nhưng ảnh không gắn link về tab Sheet -> gán tay (đã đối chiếu nội dung ảnh).
SLIDE_GID_OVERRIDE = {
    (11, 27): '307801600',  # delete_template_section (sec03) -> DELETE /api/templates/sections/:id
}

# Đường dẫn được ghi rõ trong phần chữ của slide (chỉ ghi khi slide nêu cụ thể cho đúng API đó).
SLIDE_PATHS = {
    '197301990': 'POST /api/v1/auth/signup',
    '922062722': 'POST /api/v1/auth/login',
    '1957178307': 'POST /api/v1/auth/logout',
    '443245942': 'POST /api/v1/auth/forgot-password',
    '775305043': 'PUT /api/v1/auth/change-password',
    '1383375112': 'POST /api/v1/auth/admin/create-staff',
    '1628595518': 'GET /api/v1/profile',
    '1558026343': 'PUT /api/v1/profile',
    '434290707': 'GET /api/v1/admin/users',
    '405564125': 'GET /api/v1/admin/users/:id',
    '270017767': 'DELETE /api/v1/admin/users/:id',
    '749518053': 'PUT /api/v1/admin/users/:id/assign',
    '1343149399': 'POST /api/v1/roles',
    '1046807422': 'GET /api/v1/roles',
    '1306309623': 'POST /api/v1/permissions',
    '265687709': 'GET /api/v1/permissions',
    '298841007': 'POST /api/v1/doctor/patients/',
    '839267768': 'GET /api/v1/medical_records/classify-questions',
    '1499318100': 'POST /api/v1/medical_records/classify',
    '1254044733': 'POST /api/v1/medical_records/',
    '1050343001': 'GET /api/v1/medical_records/all',
    '544052006': 'GET /api/v1/medical_records/:id',
    '312161648': 'GET /api/v1/medical_records/:id/summary',
    '1722132503': 'GET /api/v1/medical_records/patients/:id/history',
    '1452024462': 'POST /api/v1/medical_records/:id/accept',
    '1748265966': 'PUT /api/v1/medical_records/:id',
    '1276019672': 'GET /api/v1/medical_records/:id/answers',
    '147827662': 'PUT /api/v1/medical_records/:id/answers',
    '1888610589': 'DELETE /api/v1/medical_records/:id/',
    '1223801917': 'GET /api/v1/uas7-scores/eligibility',
    '2059182507': 'POST /api/v1/uas7-scores',
    '1681514373': 'GET /api/v1/uas7-scores/patient/:patient_id',
    '592167902': 'POST /api/v1/prescriptions',
    '547523451': 'POST /api/v1/lab-requests',
    '1148047163': 'GET /api/v1/lab-results/:record_id',
    '583354190': 'POST /api/v1/image-attachments/upload',
    '1147764361': 'GET /api/v1/image-attachments/user/:user_id',
    '1715175211': 'DELETE /api/v1/image-attachments/:id',
    '779139123': 'POST /api/v1/answer-images',
    '554552242': 'GET /api/v1/answer-images/:answer_id',
    '88120113': 'DELETE /api/v1/answer-images/:id',
    '1698376832': 'POST /api/v1/lesion-episodes',
    '1440092550': 'GET /api/v1/lesion-episodes/my',
    '227880350': 'GET /api/v1/lesion-episodes/:id',
    '792934479': 'PATCH /api/v1/lesion-episodes/:id',
    '1806694438': 'DELETE /api/v1/lesion-episodes/:id',
    '379040218': 'POST /api/v1/lesion-locations',
    '551441164': 'GET /api/v1/lesion-locations/episode/:episode_id',
    '384461718': 'PATCH /api/v1/lesion-locations/:id',
    '2123167729': 'DELETE /api/v1/lesion-locations/:id',
    '2112749323': 'POST /api/v1/lesion-photos',
    '692505516': '(slide chép nhầm mô tả của loc03: GET /api/v1/lesion-locations/episode/:episode_id)',
    '1813402795': 'PATCH /api/v1/lesion-photos/:id/milestone',
    '822409679': 'DELETE /api/v1/lesion-photos/:id',
    '914807654': 'POST /api/v1/notifications/',
    '707546040': 'GET /api/v1/notifications/',
    '632634762': 'PUT /api/v1/notifications/:id/read',
    '353194688': 'DELETE /api/v1/notifications/:id',
    '1970883342': 'POST /api/v1/templates',
    '349571080': 'GET /api/v1/templates/all',
    '144829180': 'GET /api/v1/templates/:id',
    '1039309919': 'PUT /api/v1/templates/:id',
    '1863562231': 'DELETE /api/v1/templates/:id',
    '936518891': 'POST /api/v1/templates/:template_id/sections',
    '177614167': 'PUT /api/v1/templates/sections/:id',
    '307801600': 'DELETE /api/v1/templates/sections/:id',
    '1351667720': 'POST /api/v1/templates/sections/:section_id/questions',
    '984006780': 'PUT /api/v1/templates/questions/:id',
    '796922015': 'DELETE /api/v1/templates/questions/:id',
}

# Kết quả đối chiếu ảnh slide với Sheet (14/11/2026). Ảnh không có trong danh sách = khớp hoàn toàn.
IMAGE_NOTES = {
    (2, 5): 'Ảnh ghi đường dẫn `POST /api/auth/signup` (không có `/v1`).',
    (2, 9): 'Ảnh ghi đường dẫn `POST /api/auth/login` (không có `/v1`).',
    (4, 23): '⚠ Ảnh trên slide là bảng của API **sửa** phòng (PUT), không phải xem chi tiết. Đặc tả dưới đây lấy đúng tab GET mà slide trỏ tới.',
    (4, 24): '⚠ Ảnh trên slide là bảng của API **tạo** phòng (POST, trùng ảnh slide set_room). Đặc tả dưới đây lấy đúng tab PUT mà slide trỏ tới.',
    (5, 27): '⚠ Ảnh trên slide trùng ảnh của get_medicalrecords_all (medrec04). Đặc tả dưới đây lấy đúng tab GET chi tiết mà slide trỏ tới.',
    (7, 9): 'Tiêu đề trong ảnh ghi nhầm "API Bác sĩ kê đơn thuốc"; bảng Input/Output khớp Sheet.',
    (9, 31): 'Ảnh slide output trùng ảnh slide input (ảnh input đã gồm cả bảng Output).',
}

# Ghi chú cho slide chữ có lỗi (tiêu đề/nội dung chép nhầm).
TEXT_NOTES = {
    (1, 1): '⚠ Link Google Doc trong ghi chú slide này trỏ tới một bài tập lập trình không liên quan (net.xml).',
    (3, 32): '⚠ Tiêu đề slide ghi "change_password" nhưng nội dung là test case của nhóm permission (perm01–perm04).',
    (9, 29): '⚠ Tiêu đề slide ghi "lesion01" nhưng nội dung là test case của loc03.',
    (9, 40): '⚠ Tiêu đề slide ghi "loc01" nhưng nội dung mô tả lphoto01 (POST /api/v1/lesion-photos).',
    (9, 41): '⚠ Tiêu đề slide ghi "loc01" nhưng nội dung là test case của lphoto01.',
    (9, 43): '⚠ Nội dung slide chép nhầm từ mô tả loc03; theo Sheet, lphoto02 là GET /api/lesion-photos/location/:location_id.',
    (9, 51): '⚠ Tiêu đề slide ghi "loc05" nhưng nội dung là test case của lphoto04.',
    (11, 34): '⚠ Tiêu đề slide ghi "sec01" nhưng nội dung là test case của ques01.',
    (11, 40): '⚠ Tiêu đề slide ghi "ques02" nhưng nội dung mô tả ques03 (DELETE câu hỏi).',
    (11, 41): '⚠ Tiêu đề slide ghi "ques02" nhưng nội dung là test case của ques03.',
}

VERIFIED = 'Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.'


def header(sources: list[str], extra: str = '') -> list[str]:
    lines = [
        '> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**',
        f'> Bản chụp tài liệu gốc ngày **{SNAPSHOT}**. Nguồn: ' + '; '.join(sources) + '.',
        '> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.',
    ]
    if extra:
        lines.append(f'> {extra}')
    return lines + ['']


def fmt(value) -> str:
    if value is None:
        return ''
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def esc(text: str) -> str:
    return text.replace('|', '\\|').replace('\r', '').replace('\n', '<br>')


def md_table(rows: list[list[str]]) -> list[str]:
    if not rows:
        return []
    width = max(len(r) for r in rows)
    rows = [r + [''] * (width - len(r)) for r in rows]
    out = ['| ' + ' | '.join(esc(c) for c in rows[0]) + ' |', '|' + '---|' * width]
    out += ['| ' + ' | '.join(esc(c) for c in r) + ' |' for r in rows[1:]]
    return out + ['']


# ---------------------------------------------------------------- Sheet

def sanitize_tab(name: str) -> str:
    return re.sub(r'[\\/?*\[\]:]', '', name)[:31]


def load_sheet():
    wb = openpyxl.load_workbook(SRC / 'api-sheet.xlsx', data_only=True)
    tabs = json.loads((SRC / 'api-sheet-tabs.json').read_text(encoding='utf-8'))
    if len(tabs) != len(wb.worksheets):
        raise SystemExit(f'Số tab không khớp: htmlview {len(tabs)} vs xlsx {len(wb.worksheets)}')
    by_gid = {}
    for (gid, name), ws in zip(tabs.items(), wb.worksheets):
        if sanitize_tab(name) != ws.title:
            print(f'  lưu ý: tab "{name}" trong xlsx tên là "{ws.title}"')
        by_gid[gid] = (name, ws)
    return by_gid


def sheet_rows(ws) -> list[list[str]]:
    rows = [[fmt(c) for c in r] for r in ws.iter_rows(values_only=True)]
    return [r for r in rows if any(r)]


def render_spec(ws) -> list[str]:
    """Bảng Input/Output của một tab đặc tả API, giữ nguyên cấp lồng như trong Sheet."""
    out, table, cols = [], [], None

    def flush():
        nonlocal table
        if table:
            has_note = any(r[5] for r in table)
            head = ['STT', 'Tham số', 'Kiểu', 'NN', 'Mô tả'] + (['Ghi chú trong Sheet'] if has_note else [])
            out.extend(md_table([head] + [r if has_note else r[:5] for r in table]))
            table = []

    for r in sheet_rows(ws):
        cells = [c for c in r if c]
        if 'Tên parameter' in r:
            cols = {k: r.index(k) for k in ('NO', 'Tên parameter', 'Type', 'NN', 'Mô tả')}
            continue
        if len(cells) == 1 and cells[0] in ('Input', 'Output', 'Bảng Input'):
            flush()
            out += [f'**{"Input" if "Input" in cells[0] else "Output"}**', '']
            continue
        if cols is None:
            out += ['Mô tả trong Sheet: ' + ' '.join(cells), '']
            continue
        names = r[cols['Tên parameter']:cols['Type']]
        j = next((k for k, c in enumerate(names) if c), None)
        if j is None:
            continue
        name = names[j]
        depth = j + (1 if name[:1] in '↳└' else 0)
        name = name.lstrip('↳└ ').strip()
        shown = ('&nbsp;' * 4 * (depth - 1) + f'↳ `{name}`') if depth else f'`{name}`'
        note = ' '.join(c for c in r[cols['Mô tả'] + 1:] if c)
        table.append([r[cols['NO']], shown, r[cols['Type']], r[cols['NN']], r[cols['Mô tả']], note])
    flush()
    return out


# ---------------------------------------------------------------- Slides

def iter_shapes(shapes):
    for sh in shapes:
        if sh.shape_type == MSO_SHAPE_TYPE.GROUP:
            yield from iter_shapes(sh.shapes)
        else:
            yield sh


def para_text(p) -> str:
    return p.text.replace('\v', ' ').strip()


def read_deck(deck: int) -> list[dict]:
    prs = Presentation(SLIDES / f'SLIDE{deck}_DrMayDay.pptx')
    slides = []
    for i, s in enumerate(prs.slides, 1):
        title_shape = s.shapes.title
        title = ''
        if title_shape is not None and title_shape.has_text_frame:
            title = ' '.join(para_text(p) for p in title_shape.text_frame.paragraphs if para_text(p))
        body, images = [], 0
        for sh in iter_shapes(s.shapes):
            if sh.shape_type == MSO_SHAPE_TYPE.PICTURE:
                images += len(sh.image.blob) >= IMAGE_MIN_BYTES
                continue
            if title_shape is not None and sh.shape_id == title_shape.shape_id:
                continue
            if sh.has_text_frame:
                for p in sh.text_frame.paragraphs:
                    t = para_text(p)
                    if t and t != '‹#›':
                        body.append((p.level, t))
        if not title and body:
            title = body.pop(0)[1]
        links = [r.target_ref for r in s.part.rels.values() if r.is_external and r.target_ref.startswith('http')]
        gids = [m.group(1) for link in links for m in [re.search(r'gid=(\d+)', link)] if m]
        notes = s.notes_slide.notes_text_frame.text.strip() if s.has_notes_slide else ''
        gid = SLIDE_GID_OVERRIDE.get((deck, i), gids[0] if gids else None)
        if deck > 1 and images and gid is None and title != 'Danh sách API':
            print(f'  cảnh báo: SLIDE{deck}/{i} "{title}" có ảnh nhưng không có link tab Sheet')
        slides.append(dict(n=i, title=title, body=body, images=images, links=links, gid=gid, notes=notes))
    return slides


def render_text_slide(deck: int, sl: dict, state: dict) -> list[str]:
    out = []
    if sl['title'] != state.get('last_title'):
        out += [f'#### {sl["title"]}', '']
        state['last_title'] = sl['title']
    out += [f'{"  " * lvl}- {t}' for lvl, t in sl['body']]
    for link in sl['links']:
        out.append(f'- Liên kết trên slide: <{link.replace("&amp;", "&")}>')
    if sl['notes']:
        out.append(f'- Ghi chú người thuyết trình: {sl["notes"]}')
    if (deck, sl['n']) in TEXT_NOTES:
        out.append(f'- {TEXT_NOTES[(deck, sl["n"])]}')
    out.append(f'- _(slide {sl["n"]})_')
    return out + ['']


def is_skippable(sl: dict, seen: set) -> bool:
    if sl['title'].startswith('Mục lục') or sl['title'] == 'Danh sách API':
        return True
    if not sl['title'] and not sl['body'] and not sl['images']:
        return True
    key = (sl['title'], tuple(sl['body']))
    if not sl['images'] and key in seen:
        return True
    seen.add(key)
    return False


def parse_api_title(title: str) -> tuple[str, str]:
    name = re.split(r'\s*\(|\s+Bản ', title)[0].strip()
    code = re.search(r'\(([a-z]+\d{2,3})\)', title)
    return name, code.group(1) if code else ''


def api_block(gid: str, by_gid: dict, deck: int, sl: dict | None, rendered: set) -> list[str]:
    tab, ws = by_gid[gid]
    out = [f'- Tab Sheet: [`{tab}`]({SHEET_TAB_URL.format(gid=gid)})']
    if gid in SLIDE_PATHS:
        out.append(f'- Đường dẫn ghi trong slide: `{SLIDE_PATHS[gid]}`')
    if sl is not None:
        out.append(f'- Ảnh slide {sl["n"]}: {IMAGE_NOTES.get((deck, sl["n"]), VERIFIED)}')
    out.append('')
    if gid in rendered:
        return out + ['_Đặc tả Input/Output: xem mục ngay phía trên (cùng tab Sheet)._', '']
    rendered.add(gid)
    return out + render_spec(ws)


def build_module(deck: int, by_gid: dict, assigned: dict, index: list) -> None:
    fname = MODULES[deck]
    rendered, out, state, seen = set(), [], {}, set()
    if deck <= 11:
        slides = read_deck(deck)
        part = slides[0]['body'][-1][1] if slides[0]['body'] else slides[0]['title']
        out += [f'# {part}', ''] + header([f'`tai-lieu-goc/SLIDE{deck}_DrMayDay.pptx`',
                                           f'[Sheet API](https://docs.google.com/spreadsheets/d/{SHEET_ID})'])
        out += ['Thứ tự trình bày giữ nguyên thứ tự slide. Bảng Input/Output lấy từ tab Sheet mà ảnh slide trỏ tới. '
                'Cột NN: `O` = bắt buộc, `X` = không bắt buộc.', '']
        for sl in slides[1:]:
            if is_skippable(sl, seen):
                continue
            if sl['images'] and sl['gid'] and sl['gid'] in by_gid:
                state['last_title'] = None
                name, code = parse_api_title(sl['title'])
                out += [f'### {sl["title"]}', ''] + api_block(sl['gid'], by_gid, deck, sl, rendered)
                if sl['gid'] not in {e['gid'] for e in index}:
                    index.append(dict(gid=sl['gid'], tab=by_gid[sl['gid']][0], name=name, code=code,
                                      deck=deck, slide=sl['n'], file=fname))
            else:
                out += render_text_slide(deck, sl, state)
    else:
        out += [f'# {AI_MODULE_TITLE}', ''] + header([f'[Sheet API](https://docs.google.com/spreadsheets/d/{SHEET_ID})'])
    extras = [g for g, d in assigned.items() if d == deck and g not in rendered]
    if extras:
        out += ['## API có trong Sheet nhưng không có slide', '']
        for gid in extras:
            out += [f'### {by_gid[gid][0]}', ''] + api_block(gid, by_gid, deck, None, rendered)
            index.append(dict(gid=gid, tab=by_gid[gid][0], name='', code='', deck=deck, slide=None, file=fname))
    (API_DIR / f'{fname}.md').write_text('\n'.join(out), encoding='utf-8', newline='\n')
    print(f'02-api/{fname}.md')


def build_api(by_gid: dict) -> None:
    API_DIR.mkdir(parents=True, exist_ok=True)
    linked = {}
    for deck in range(2, 12):
        for sl in read_deck(deck):
            if sl['images'] and sl['gid']:
                linked.setdefault(sl['gid'], deck)
    assigned = {**linked, **{g: d for g, d in EXTRA_TAB_MODULE.items() if g not in linked}}
    spec_gids = [g for g, (name, _) in by_gid.items() if not re.match(r'^[123]\. ', name)]
    missing = [by_gid[g][0] for g in spec_gids if g not in assigned]
    if missing:
        raise SystemExit(f'Tab chưa gán phần: {missing}')
    index = []
    for deck in MODULES:
        build_module(deck, by_gid, assigned, index)
    build_api_index(index)


def build_api_index(index: list) -> None:
    out = ['# Danh sách API', ''] + header([f'[Sheet API](https://docs.google.com/spreadsheets/d/{SHEET_ID})',
                                            '`tai-lieu-goc/SLIDE2..11`'])
    out += [f'Tổng cộng **{len(index)}** API (mỗi tab đặc tả trong Sheet là một API).',
            '',
            '- **Method + đường dẫn (tên tab Sheet)**: lấy nguyên văn từ tên tab trong Sheet.',
            '- **Đường dẫn ghi trong slide**: chỉ điền khi phần chữ của slide nêu cụ thể cho đúng API đó.',
            '- Hai cột này đang lệch nhau về tiền tố `/api` và `/api/v1`, xem [05-mau-thuan-can-chot.md](../05-mau-thuan-can-chot.md).',
            '']
    rows = [['#', 'Phần', 'Mã slide', 'Tên trên slide', 'Method + đường dẫn (tên tab Sheet)', 'Đường dẫn ghi trong slide', 'Slide']]
    for k, e in enumerate(index, 1):
        slide = f'SLIDE{e["deck"]} / {e["slide"]}' if e['slide'] else 'không có slide'
        rows.append([str(k), f'[{e["file"][:2]}]({e["file"]}.md)', e['code'], e['name'], f'`{e["tab"]}`',
                     f'`{SLIDE_PATHS[e["gid"]]}`' if e['gid'] in SLIDE_PATHS else '', slide])
    out += md_table(rows)
    out += ['Tài liệu chi tiết từng phần:', '']
    out += [f'- [{f}]({f}.md)' for f in MODULES.values()]
    out += ['- [00-quy-uoc-va-ma-phan-hoi.md](00-quy-uoc-va-ma-phan-hoi.md)', '']
    (API_DIR / 'README.md').write_text('\n'.join(out), encoding='utf-8', newline='\n')
    print('02-api/README.md')


def build_response_codes(by_gid: dict) -> None:
    ws = next(ws for name, ws in by_gid.values() if name.startswith('3. '))
    rows = sheet_rows(ws)
    left, right, group = [['Mã', 'Message', 'Ghi chú', 'Nhóm']], [rows[0][5:12]], ''
    for r in rows[1:]:
        if r[0]:
            group = r[3] or group
            left.append([r[0], r[1], r[2], group])
        if any(r[5:12]):
            right.append(r[5:12])
    out = ['# Mã phản hồi (response code)', ''] + header(
        [f'[Sheet API, tab "3. response code"]({SHEET_TAB_URL.format(gid="1513579546")})'])
    out += ['## Bảng mã chi tiết (bảng bên trái của tab)', '',
            'Các test case trong slide đều dùng bảng này. Trong Sheet, trường `code` của response có kiểu `string`.', '']
    out += md_table(left)
    out += ['## Bảng mã gộp theo chuẩn cũ (bảng bên phải của tab)', '',
            'Ánh xạ các mã chi tiết vào bộ mã cũ (9992–9999, 1001–1010) theo vị trí bit.', '']
    out += md_table(right)
    (API_DIR / '00-quy-uoc-va-ma-phan-hoi.md').write_text('\n'.join(out), encoding='utf-8', newline='\n')
    print('02-api/00-quy-uoc-va-ma-phan-hoi.md')


def generic_sheet_table(ws) -> list[str]:
    rows = sheet_rows(ws)
    start = next(k for k, r in enumerate(rows) if sum(1 for c in r if c) >= 3)
    keep = [k for k, c in enumerate(rows[start]) if c] or list(range(len(rows[start])))
    lo, hi = min(keep), max(len(r) for r in rows)
    pre = [' '.join(c for c in r if c) for r in rows[:start]]
    return [p for p in pre] + [''] + md_table([r[lo:hi] for r in rows[start:]])


def build_plan(by_gid: dict) -> None:
    out = ['# Kế hoạch API theo tuần và danh sách API đã có (ĐATN)', ''] + header(
        [f'[Sheet API, tab "1. Weekly API"]({SHEET_TAB_URL.format(gid="2125155598")})',
         f'[tab "2. API đã có_ĐATN"]({SHEET_TAB_URL.format(gid="0")})'],
        'Repo code cũ `github.com/doantrunghieu08/datn_cuc_mai` được tab 2 trỏ tới hiện không truy cập công khai được (404).')
    for prefix, title in (('1. ', 'Phân phối API theo tuần'), ('2. ', 'API đã có trong đồ án cũ (datn_cuc_mai)')):
        ws = next(ws for name, ws in by_gid.values() if name.startswith(prefix))
        out += [f'## {title}', ''] + generic_sheet_table(ws)
    (DOCS / '06-ke-hoach-tuan-va-api-cu.md').write_text('\n'.join(out), encoding='utf-8', newline='\n')
    print('06-ke-hoach-tuan-va-api-cu.md')


# ---------------------------------------------------------------- Overview (SLIDE1)

def build_overview() -> None:
    out = ['# Tổng quan và yêu cầu của đề tài DrMayDay', ''] + header(['`tai-lieu-goc/SLIDE1_DrMayDay.pptx`'])
    state, seen = {}, set()
    for sl in read_deck(1):
        if is_skippable(sl, seen):
            continue
        if sl['images']:
            out += ['#### ' + sl['title'], '',
                    '- Slide chỉ có một mã QR, giải mã ra `https://qr.generatorqr.com/9PPethzZs` '
                    '(trang chuyển hướng động, chưa xác minh được đích; nhiều khả năng là Sheet API). '
                    'Danh sách API đầy đủ: [02-api/README.md](02-api/README.md).', '']
            continue
        out += render_text_slide(1, sl, state)
    (DOCS / '01-tong-quan-yeu-cau.md').write_text('\n'.join(out), encoding='utf-8', newline='\n')
    print('01-tong-quan-yeu-cau.md')


# ---------------------------------------------------------------- Word documents
# Đọc thẳng XML thay vì python-docx: python-docx bỏ qua nội dung trong content control (w:sdt)
# và trong vùng theo dõi thay đổi (w:ins). Ở đây giữ cả hai và đánh dấu thay đổi.

W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'


def w(tag: str) -> str:
    return f'{{{W_NS}}}{tag}'


def flatten(el):
    """Con trực tiếp của el, nhưng đi xuyên qua các lớp bọc w:sdt / w:customXml."""
    for child in el:
        if child.tag in (w('sdt'), w('customXml')):
            content = child.find(w('sdtContent')) if child.tag == w('sdt') else child
            if content is not None:
                yield from flatten(content)
        else:
            yield child


def run_segments(el, state: str, segs: list) -> None:
    for child in el:
        tag = child.tag
        if tag == w('ins'):
            run_segments(child, 'ins', segs)
        elif tag == w('del'):
            run_segments(child, 'del', segs)
        elif tag == w('t') and state != 'del':
            segs.append((state, child.text or ''))
        elif tag == w('delText'):
            segs.append(('del', child.text or ''))
        elif tag in (w('tab'), w('br')):
            segs.append((state, ' '))
        elif tag == w('commentReference'):
            segs.append(('plain', f' [bình luận {child.get(w("id"))}]'))
        elif tag not in (w('pPr'), w('rPr')):
            run_segments(child, state, segs)


def paragraph_text(p) -> str:
    segs = []
    run_segments(p, 'plain', segs)
    merged = []
    for kind, text in segs:
        if merged and merged[-1][0] == kind:
            merged[-1] = (kind, merged[-1][1] + text)
        else:
            merged.append((kind, text))
    parts = []
    for kind, text in merged:
        if not text.strip():
            parts.append(text)
        elif kind == 'ins':
            parts.append(f'<ins>{text}</ins>')
        elif kind == 'del':
            parts.append(f'~~{text.strip()}~~ ' if text.endswith(' ') else f'~~{text}~~')
        else:
            parts.append(text)
    return ''.join(parts).strip()


def paragraph_line(p, styles: dict) -> str:
    text = paragraph_text(p)
    if not text:
        return ''
    ppr = p.find(w('pPr'))
    style_id = ppr.find(w('pStyle')).get(w('val')) if ppr is not None and ppr.find(w('pStyle')) is not None else ''
    style = styles.get(style_id, style_id).lower()
    if style == 'title':
        return f'## {text}'
    if style.startswith('heading'):
        level = int(re.sub(r'\D', '', style) or 1)
        return '#' * min(level + 1, 6) + ' ' + text
    if 'list' in style or (ppr is not None and ppr.find(w('numPr')) is not None):
        return f'- {text}'
    return text


def table_rows(tbl) -> list[list[str]]:
    rows = []
    for tr in flatten(tbl):
        if tr.tag != w('tr'):
            continue
        trpr = tr.find(w('trPr'))
        row_change = ''
        if trpr is not None:
            row_change = 'ins' if trpr.find(w('ins')) is not None else 'del' if trpr.find(w('del')) is not None else ''
        cells = []
        for tc in flatten(tr):
            if tc.tag != w('tc'):
                continue
            text = '<br>'.join(t for t in (paragraph_text(p) for p in tc.iter(w('p'))) if t)
            if row_change == 'ins' and text and '<ins>' not in text:
                text = f'<ins>{text}</ins>'
            cells.append(text)
            span = tc.find(f'{w("tcPr")}/{w("gridSpan")}')
            if span is not None:
                cells += [''] * (int(span.get(w('val'))) - 1)
        rows.append(cells)
    return rows


def docx_to_md(path: Path) -> list[str]:
    d = docx.Document(path)
    styles = {s.style_id: s.name for s in d.styles}
    body = d.element.body
    out = []
    for el in flatten(body):
        if el.tag == w('p'):
            line = paragraph_line(el, styles)
            if line:
                out += [line, '']
        elif el.tag == w('tbl'):
            out += md_table(table_rows(el))
    comments_part = next((r.target_part for r in d.part.rels.values() if r.reltype.endswith('/comments')), None)
    if comments_part is not None:
        from lxml import etree
        root = etree.fromstring(comments_part.blob)
        out += ['## Bình luận trong tài liệu gốc', '']
        for c in root.iter(w('comment')):
            text = ' '.join(t for t in (paragraph_text(p) for p in c.iter(w('p'))) if t)
            out.append(f'- [bình luận {c.get(w("id"))}] {c.get(w("author"))} ({(c.get(w("date")) or "")[:10]}): {text}')
        out.append('')
    return out


def tracked_changes_summary(path: Path) -> str:
    d = docx.Document(path)
    marks = list(d.element.body.iter(w('ins'))) + list(d.element.body.iter(w('del')))
    if not marks:
        return ''
    by_author = {}
    for m in marks:
        key = m.get(w('author')) or '?'
        by_author.setdefault(key, []).append((m.get(w('date')) or '')[:10])
    who = '; '.join(f'{a} ({min(ds)} → {max(ds)}, {len(ds)} chỗ)' for a, ds in by_author.items())
    return ('Tài liệu gốc chứa các sửa đổi ở chế độ theo dõi (track changes) chưa được chấp nhận/từ chối: '
            f'<ins>gạch chân</ins> = nội dung đề xuất thêm, ~~gạch ngang~~ = nội dung đề xuất xóa. Người sửa: {who}.')


def build_word_docs() -> None:
    jobs = (
        ('co-so-du-lieu.docx', '03-co-so-du-lieu.md', DB_DOC_URL, 'Tài liệu mô tả cơ sở dữ liệu'),
        ('tu-dien-du-lieu-183-bien.docx', '04-tu-dien-du-lieu-183-bien.md', DICT_DOC_URL,
         'Từ điển dữ liệu 183 biến lâm sàng (BV Da liễu Trung ương)'),
    )
    for src, dest, url, title in jobs:
        out = [f'# {title}', ''] + header([f'[Google Doc]({url})', f'bản chụp `docs/nguon/{src}`'],
                                          tracked_changes_summary(SRC / src))
        out += docx_to_md(SRC / src)
        (DOCS / dest).write_text('\n'.join(out), encoding='utf-8', newline='\n')
        print(dest)


def main() -> None:
    by_gid = load_sheet()
    build_overview()
    build_api(by_gid)
    build_response_codes(by_gid)
    build_plan(by_gid)
    build_word_docs()


if __name__ == '__main__':
    main()
