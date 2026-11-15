# Spike Prisma 7.10.1 + PostgreSQL (schema `final_restructured.sql`) - kết quả

> **Ghi chú khi đưa vào repo (2026-11-15). Đây là tài liệu lịch sử.** Spike chạy trong thư mục tạm của phiên làm việc, trên container `drmayday-pg-spike` ở cổng 55433. Container này không còn. Các file nhắc tới bên dưới **không có trong repo**: `schema.pulled.prisma`, `prisma/schema.prisma` của spike, `schema.with-view.pulled.prisma`, `spike*.ts`, `t4.ts`, `*.log`, `fix-schema.mjs`, `pull-views/`. Script sửa schema chính thức là `apps/api/scripts/patch-schema.mjs`. CSDL dev/test chính thức dùng cổng 5434. Cả hai do [spec A](../superpowers/specs/2026-11-15-csdl-that-a-nen-tang-design.md) tạo ra (mục 3). Các khuyến nghị dưới đây đã được spec A chốt thành thiết kế.

Môi trường: `postgres:17` (PostgreSQL 17.11), container `drmayday-pg-spike`, `prisma` / `@prisma/client` / `@prisma/adapter-pg` đều 7.10.1 (đúng bản repo), `pg`, `tsx`, Node 22.23.4.
Generator giống repo: `prisma-client`, `moduleFormat = "esm"`, `importFileExtension = "js"`.

Lưu ý lệch yêu cầu: cổng 127.0.0.1:5433 đang bị container `lms-postgres` (0.0.0.0:5433) chiếm, nên container spike publish ở **127.0.0.1:55433** để khỏi đụng/nhầm với DB của người khác. Không động tới container nào khác.

File trong thư mục spike (lịch sử, không có trong repo):
- `schema.pulled.prisma`: đúng như `prisma db pull` sinh ra (KHÔNG generate được, xem mục 2).
- `prisma/schema.prisma`: bản sửa tay tối thiểu (do `fix-schema.mjs` tạo ra từ file pulled); generate chạy được.
- `schema.with-view.pulled.prisma`: kết quả pull khi bật `previewFeatures = ["views"]` (có khối `view`).
- `spike.ts` (vòng 1, chạy trên schema pulled+@@unique, chưa bỏ default), `spike2.ts` (vòng 2, schema đã sửa), `spike3.ts`, `t4.ts`; log: `load.log`, `pull.log`, `generate1.log`, `run1.log`, `run2.log`.

## 1. Nạp SQL

`psql -v ON_ERROR_STOP=1 -f` trong container: **thành công**, file bọc trong `BEGIN ... COMMIT`, không có dòng lỗi nào (`load.log`, md5 file trong container trùng file gốc). Kết quả: 43 bảng, 1 view (`v_chukytheodoiuas7`), 2 function, 197 CHECK, 10 FK deferrable. Seed sẵn trong SQL: `vaitro` 4 dòng (`admin`=1, `bac_si`=2, `dieu_duong`=3, `benh_nhan`=4) và `loainghiemphap` 9 dòng.

## 2. `prisma db pull`

Pull xong 43 model (view không có model, xem mục g). Cảnh báo Prisma in ra (nguyên văn nhóm, danh sách đầy đủ ở `pull.log`):

1. **Kiểu không hỗ trợ**: 3 cột INTERVAL của `benhanmaydaycap` (`thoi_gian_tiep_xuc_den_khoi_phat`, `thoi_gian_keo_dai_tb`, `dot_gan_nhat_cach`) -> `Unsupported("interval")?`.
2. **CHECK constraint không hỗ trợ**: ~197 constraint ở hầu hết các bảng (vd `nguoi.ck_nguoi_sdt`, `hosobenhan.ck_hosobenhan_trang_thai`...). Prisma chỉ cảnh báo, không đưa vào schema.
3. **FK/PK/unique deferrable**: 10 constraint `fk_benhanmaydaycap_hoso`, `fk_benhanmaydayman_hoso`, `fk_hoso_bat_buoc_cap/man`, `fk_kqcls_bat_buoc_cap/man`, `fk_phien_bat_buoc_cap/man`, `fk_phienkhamcap_phienkham`, `fk_phienkhamman_phienkham` ("non-default deferring ... not yet fully supported").
4. **Comment trong DB**: gần như mọi model và nhiều field (cảnh báo vô hại).
5. **Expression index**: `taikhoan.uq_tai_khoan_ten_dang_nhap` (`lower(ten_dang_nhap)`). Index này không xuất hiện trong schema; `ten_dang_nhap` chỉ là `String @db.VarChar(100)` không có `@unique`.
6. Không có cảnh báo riêng cho generated column, trigger, view. Index một phần (partial) được đưa vào nhờ `previewFeatures = ["partialIndexes"]`, tự thêm vào generator.

Generated column được sinh thành cột thường **kèm `@default(dbgenerated("<biểu thức>"))`** (vd `ma_subtype_cap BigInt? @default(dbgenerated("CASE WHEN ..."))`, `co_nguy_co_phan_ve`, `ket_qua_dieu_huong`, `nlr`, `plr`, `diem_uas_ngay`, `ngay_bat_dau_chu_ky`...). Prisma Client không biết chúng là read-only (xem mục f).

### 2.1 LỖI CHẶN: `prisma generate` thất bại trên schema vừa pull (P1012)

```
Error code: P1012
error: Error parsing attribute "@relation": A one-to-one relation must use unique fields on the defining side.
Either add an `@@unique([ma_ho_so, loai_benh_an])` attribute to the model, or change the relation to one-to-many.
Validation Error Count: 6
```

6 chỗ: `benhanmaydaycap`, `benhanmaydayman` (`ma_ho_so, loai_benh_an`), `ketquacanlamsangcap`, `ketquacanlamsangman` (`ma_ket_qua_can_lam_sang, loai_ket_qua_can_lam_sang`), `phienkhamcap`, `phienkhamman` (`ma_phien_kham, loai_benh_an`). Nguyên nhân: FK ghép (PK + cột `loai_*` generated) trỏ tới `UNIQUE(ma_*, loai_*)` của bảng cha. DB không có unique trên cặp ở bảng con (PK đơn đã đủ), nên Prisma coi là 1-1 không hợp lệ.

Cách sửa (đã áp dụng, không đổi DB): thêm `@@unique([ma_*, loai_*])` vào 6 model ở **mức Prisma** (chỉ là khai báo, ta không chạy migrate). Sau đó `generate` OK.

### 2.2 LỖI RUNTIME: `@default("CAP")` literal trên cột generated `loai_*` (xem 3c)

Pull sinh `loai_benh_an String? @default("CAP")` cho 6 cột `loai_*` của bảng subtype (vì biểu thức generated là hằng `'CAP'::text`). Prisma Client sẽ gửi giá trị này khi `create` -> Postgres từ chối (428C9). Phải xoá 6 `@default("CAP"|"MAN")` này khỏi schema (đã làm trong `fix-schema.mjs`).

=> **Mỗi lần nhóm DB đổi schema và ta `db pull` lại, phải chạy lại bước sửa tay này.** Nên giữ một script `fix-schema` (như `fix-schema.mjs`) trong repo hoặc tách thành bước `pull -> patch -> generate` cố định, không sửa tay.

## 3. Kết quả từng kiểm tra a) - h)

Mọi lỗi đều tới từ `PrismaClient` với adapter `@prisma/adapter-pg`. Điểm chung: **Prisma 7 + driver adapter không điền `meta.target`/`meta.field_name`**; thông tin nằm ở `meta.driverAdapterError.cause` (`kind`, `originalCode` = SQLSTATE, `constraint.index` = tên constraint/index).

### a) Unique trên `lower(ten_dang_nhap)`

Chạy: tạo `taikhoan` `Admin146498`, rồi `admin146498` (khác hoa/thường).

```
code: "P2002"  class: PrismaClientKnownRequestError
meta: { modelName: "taikhoan",
  driverAdapterError: { name: "DriverAdapterError", cause: {
    originalCode: "23505", kind: "UniqueConstraintViolation",
    constraint: { index: "uq_tai_khoan_ten_dang_nhap" }, table: "taikhoan" } } }
message: Unique constraint failed on the constraint: `uq_tai_khoan_ten_dang_nhap`
```

Unique thường (`uq_tai_khoan_nguoi`, trùng `ma_nguoi`) có cùng dạng, chỉ khác `constraint.index`. FK sai (`ma_vai_tro=999`) -> `P2003`, `cause.kind = ForeignKeyConstraintViolation`, `constraint.index = fk_tai_khoan_vai_tro`. NOT NULL (qua `$executeRaw`) -> `P2010`, `cause.kind = NullConstraintViolation`.

Kết luận:
- Cách nhận diện giống MySQL hiện tại, chỉ cần đổi nguồn: `meta.driverAdapterError.cause.constraint.index` (hàm `isUniqueViolation` hiện có đã đúng đường dẫn, và `cause.kind === "UniqueConstraintViolation"` dùng được thay cho `error.code === 'P2002'`).
- **Bẫy bảo mật/đúng đắn:** tra cứu username không phân biệt hoa thường bằng `where: { ten_dang_nhap: { equals: x, mode: 'insensitive' } }` sinh `WHERE ten_dang_nhap ILIKE $1` (đã bật log query xác nhận). Hai hệ quả đã kiểm chứng: (1) **`ILIKE` coi `%` và `_` là wildcard, không escape**: `equals: '%'` trả về tài khoản `Admin146498`, `equals: 'A_min146498'` cũng khớp; (2) `ILIKE` không dùng được index `lower(ten_dang_nhap)`. Với login phải dùng `$queryRaw` `WHERE lower(ten_dang_nhap) = lower($1)` (đã chạy OK, dùng đúng index). Tương tự khi tạo: bắt P2002 với index `uq_tai_khoan_ten_dang_nhap`.
- Prisma không thể `findUnique` theo `ten_dang_nhap` (không có `@unique`); chỉ có `findFirst` hoặc raw.

### b) CHECK violation

- `so_dien_thoai = '123'`:
```
code: "P2039"  (PrismaClientKnownRequestError)
meta.driverAdapterError.cause: { originalCode: "23514", kind: "postgres", code: "23514", severity: "ERROR",
  message: 'new row for relation "nguoi" violates check constraint "ck_nguoi_sdt"', detail: "Failing row contains (...)." }
message: Database error. Code: `23514`. Message: `new row for relation "nguoi" violates check constraint "ck_nguoi_sdt"`
```
  Tên constraint **không** nằm ở trường riêng (khác unique/FK); chỉ có trong `cause.message` (và `message`). Phải bóc bằng regex `violates check constraint "([^"]+)"` hoặc so khớp chuỗi. `cause.detail` chứa nguyên dòng dữ liệu lỗi (có thể lộ dữ liệu cá nhân, không được trả ra client / log thô).
- `gioi_tinh = 'Khac'`: cột `VARCHAR(3)` nên Postgres báo độ dài **trước** khi tới CHECK: `P2000`, `cause.kind = LengthMismatch`, `originalCode 22001` ("value too long for type character varying(3)"), `Column: (not available)`. Giá trị hợp lệ chỉ `Nam` / `Nu`. Giá trị 3 ký tự sai (`Xyz`) mới ra `P2039` + `ck_nguoi_gioi_tinh`. `ho_ten` toàn khoảng trắng -> `P2039` + `ck_nguoi_ho_ten`.
- CHECK qua `$executeRaw`/`$queryRaw` ra `P2010` (không phải P2039), `cause.kind = "postgres"`, `originalCode = 23514`.

Kết luận: không có kiểu lỗi "CHECK" riêng. Nhận diện bằng `cause.originalCode === '23514'` (hoặc `cause.code`), không dựa vào `error.code` (P2039 hoặc P2010 tùy đường gọi). Vì CHECK là luật nghiệp vụ của nhóm DB (SĐT 10 chữ số, enum trạng thái...), **validate ở DTO/Zod trước khi xuống DB** và chỉ dùng CHECK làm lưới an toàn: ánh xạ `23514` -> lỗi validation chung (kèm tên constraint trong log, không trả `detail` ra ngoài). Nếu muốn thông báo lỗi theo từng constraint, cần bảng ánh xạ `tên constraint -> mã lỗi nghiệp vụ`.

### c) FK deferred và subtype bắt buộc

Module finalize của SQL (dòng 1261-1500) **không có trigger/constraint trigger**: nó chỉ thêm FK `DEFERRABLE INITIALLY DEFERRED` từ cột generated (`hosobenhan.ma_subtype_cap/man`, tương tự `phienkham`, `ketquacanlamsang`) tới bảng subtype. Cột generated chỉ khác NULL khi `loai_*='CAP'/'MAN'` nên FK ép hồ sơ CAP phải có dòng `benhanmaydaycap` (và hồ sơ MAN phải có `benhanmaydayman`) lúc COMMIT. Chiều ngược (`benhanmaydaycap(ma_ho_so, loai_benh_an)` -> `hosobenhan`) cũng deferred. Danh sách trigger: xem mục 4.

Kết quả đã chạy (vòng 2, schema đã sửa):
- **c1: OK**. Trong một `$transaction(async tx => ...)`: `tx.hosobenhan.create({ma_benh_nhan, loai_benh_an:'CAP'})` rồi `tx.benhanmaydaycap.create({ma_ho_so, nhap_vien:false})` commit thành công. `trang_thai` tự có `'draft'`, `ma_subtype_cap` được DB tự điền và đọc lại đúng.
- c1d: tạo subtype **trước** hồ sơ (dùng id dự đoán từ sequence) cũng OK trong tx (cho thấy FK ngược cũng deferred, nhưng không nên dùng).
- c3: MAN + `benhanmaydayman.create({ma_ho_so})` chỉ với `ma_ho_so` -> OK.
- Vòng 1 (schema chưa bỏ `@default("CAP")`): `tx.benhanmaydaycap.create` lỗi `P2039`, `cause.originalCode "428C9"`: `cannot insert a non-DEFAULT value into column "loai_benh_an"` (xem 2.2). Cách `$executeRaw insert` hoạt động. Nested create từ `hosobenhan` (qua relation `benhanmaydaycap_hosobenhan_ma_subtype_capTobenhanmaydaycap`) **không dùng được**: `Unknown argument` (relation đi qua cột generated). Phải tạo cha rồi con trong `$transaction` tuần tự.
- **c2: MAN không có subtype row, interactive `$transaction`** -> commit THẤT BẠI, và lỗi ném ra **không phải** `PrismaClientKnownRequestError`:
```
class: DriverAdapterError (extends Error, instanceof PrismaClientKnownRequestError = false)
name: "DriverAdapterError"   message: "ForeignKeyConstraintViolation"
code: undefined, meta: undefined
cause: { originalCode: "23503", kind: "ForeignKeyConstraintViolation",
         originalMessage: 'insert or update on table "hosobenhan" violates foreign key constraint "fk_hoso_bat_buoc_man"',
         constraint: { index: "fk_hoso_bat_buoc_man" } }
stack: ... at PgTransaction.onError (@prisma/adapter-pg/dist/index.mjs)
```
  Sau đó DB không có hồ sơ MAN mồ côi (đã đếm = 0), tức transaction rollback đúng.
- c2b: cùng thao tác **không bọc transaction** (autocommit) -> deferred FK vẫn kiểm tra ngay cuối câu lệnh, lỗi dạng thường `P2003`, `constraint.index = fk_hoso_bat_buoc_man`. Tức không thể tạo hồ sơ mà không kèm subtype nếu không dùng transaction.
- c2c: `$transaction([ ...batch ])` -> `P2003` bình thường (có `batchRequestIdx`).
- c4: xoá `hosobenhan` khi còn dòng subtype -> cũng `DriverAdapterError` thô (`23503`, `fk_benhanmaydaycap_hoso`) vì đây là FK deferred bị kiểm tra lúc commit. c5: xoá subtype trước rồi hosobenhan trong cùng tx -> OK.

Kết luận quan trọng cho data-access layer:
1. Mọi thao tác ghi liên quan hồ sơ/phiên khám/KQ CLS phải nằm trong `$transaction` interactive (cha + subtype cùng lúc); thiết kế repository dạng `createCaseFile(type, base, subtype)` bọc sẵn.
2. **Lỗi lúc COMMIT của interactive transaction thoát ra dưới dạng `DriverAdapterError` thô** (không có `code`/`meta`, thông tin ở `error.cause`). `isUniqueViolation/isForeignKeyViolation` hiện tại chỉ nhìn `PrismaClientKnownRequestError` nên sẽ **bỏ sót**; bộ lọc exception cuối cùng sẽ thấy lỗi lạ (500). Cần helper chuẩn hoá: lấy `cause` từ `error.meta?.driverAdapterError?.cause ?? error.cause` (nếu `error.name === 'DriverAdapterError'`), rồi so `cause.kind` / `cause.originalCode`. Import lớp `DriverAdapterError` từ `@prisma/driver-adapter-utils` (không phải từ `Prisma`) hoặc so `name`.
3. Việc kiểm tra "bắt buộc có subtype" xảy ra ở COMMIT: nếu code ghi cha mà quên con thì lỗi chỉ lộ cuối transaction (khó định vị). Nên đặt tên rõ và có test.
4. Quan hệ do Prisma sinh có tên rất dài (`benhanmaydaycap_hosobenhan_ma_subtype_capTobenhanmaydaycap`...). Nên `include/select` qua repository bọc lại, hoặc đổi tên bằng `@relation(name: ...)`/map field trong script patch (sẽ phải lặp lại sau mỗi lần pull).

### d) BIGINT

- Mọi id (`IDENTITY` BIGINT) trả về `typeof === 'bigint'`; `JSON.stringify(nguoi)` ném `TypeError: Do not know how to serialize a BigInt`.
- `$queryRaw`: `count(*)` -> `bigint`, `1::int` -> `number`, `numeric` -> `Decimal`/chuỗi (log in `"1.5"`, `Decimal`), `int8` -> `bigint`.
- Truyền `number` vào `where: { ma_nguoi: 1 }` hoạt động ở runtime (thử `Number(id) as any`) nhưng sai kiểu TypeScript (TS yêu cầu `bigint`).
- `Decimal` (vd `thoi_gian_khoi_phat_tuan NUMERIC(12,2)`) là `Prisma.Decimal` (cần `.toString()`/`toNumber()` khi trả JSON).

Khuyến nghị: không `BigInt.prototype.toJSON` toàn cục. Chọn một trong hai và áp nhất quán: (1) mapper trong repository đổi `bigint -> string` (id dạng chuỗi trên API, an toàn cho JS và mobile), hoặc (2) interceptor/serializer chung đổi bigint thành chuỗi. Với DTO đầu vào, parse chuỗi id -> `BigInt(...)` có validate (regex `^\d+$`, giới hạn int8). Cần quyết định một kiểu ID duy nhất ở API (hiện MySQL đang dùng kiểu nào thì phải đổi theo), vì mọi `where`/FK/`include` của Prisma đều đòi `bigint`.

### e) INTERVAL

- Pull: `Unsupported("interval")?` cho 3 cột.
- `findFirst()` trên `benhanmaydaycap`: **cột interval không xuất hiện trong kết quả** (bị bỏ hoàn toàn, kể cả khi `select`).
- `create({ data: { thoi_gian_tiep_xuc_den_khoi_phat: '2 hours' } })` -> `PrismaClientValidationError: Unknown argument ...`. Không thể ghi qua model API. Cột nullable nên create/update thông thường vẫn chạy và **không đụng** giá trị interval có sẵn (đã kiểm: sau `update benh_phu` interval giữ nguyên `3 days 04:00:00`).
- `$queryRaw` đọc interval **không cast** (kể cả `select *`) -> `P2010`: `cause.kind = "UnsupportedNativeDataType"`, `type: "interval"`, "Failed to deserialize column of type 'interval'...".
- **Đọc qua `$queryRaw` có cast thì OK**: `col::text` -> `"01:30:00"`, `"3 days 04:00:00"`; `extract(epoch from col)::float8` -> `5400` (number); `to_char(col,'DD HH24:MI:SS')` cũng được.
- **Ghi qua `$executeRaw` OK** khi cast tham số: `${'PT90M'}::interval` (chuỗi ISO 8601 được Postgres chấp nhận), `${'3 days 04:00:00'}::interval`, `make_interval(secs => ${3600}::float8)`. Giá trị âm vi phạm CHECK -> `P2010`, `originalCode 23514`, `ck_benhanmaydaycap_tiep_xuc`; chuỗi sai -> `P2010`, `22007`.

Khuyến nghị: bọc 3 cột interval trong repository riêng cho `benhanmaydaycap`: đọc bằng `$queryRaw` + `extract(epoch ...)` (hoặc `::text`), ghi bằng `$executeRaw` + `make_interval(secs => $n::float8)` chạy trong cùng transaction với phần còn lại. Trên API nên dùng một đơn vị thống nhất (giây hoặc chuỗi ISO 8601 duration) và quy đổi ở repository. Không dùng `select *` trên bảng có interval.

### f) Generated column

- Create không truyền cột generated: OK (Prisma không gửi vì default là `dbgenerated`); **Prisma đọc lại giá trị generated đúng** nhờ `RETURNING` (vd `sanglocbaodongdo.co_nguy_co_phan_ve=true`, `ket_qua_dieu_huong='NGUY_CO_PHAN_VE'`; `hosobenhan.ma_subtype_cap='6'`).
- Cố ghi cột generated (kiểu TypeScript cho phép vì chúng là field optional bình thường):
```
create sanglocbaodongdo { co_nguy_co_phan_ve: true }  -> P2039, cause.originalCode "428C9",
   'cannot insert a non-DEFAULT value into column "co_nguy_co_phan_ve"'  detail: 'Column ... is a generated column.'
update { ket_qua_dieu_huong: 'X' } -> P2039, 428C9 'column "ket_qua_dieu_huong" can only be updated to DEFAULT'
create hosobenhan { ma_subtype_cap: 1n } -> P2039, 428C9
```
- `where`/`orderBy` trên cột generated hoạt động (`where: { co_nguy_co_phan_ve: true }`, partial index dùng được).
- CHECK liên cột sử dụng cột generated (`ck_sanglocbaodongdo_xac_nhan`): nguy cơ phản vệ mà thiếu `xac_nhan_muon_goi_cap_cuu` -> `P2039` + 23514. Tức nghiệp vụ "có nguy cơ thì phải có xác nhận" nằm ở DB, API phải tự tính cờ nguy cơ để biết có cần field xác nhận.
- Danh sách cột generated (đều phải coi là read-only): `hosobenhan.ma_subtype_cap/man`, `phienkham.ma_subtype_cap/man`, `ketquacanlamsang.ma_subtype_cap/man`, `benhanmaydaycap.loai_benh_an`, `benhanmaydayman.loai_benh_an`, `phienkhamcap.loai_benh_an`, `phienkhamman.loai_benh_an`, `ketquacanlamsangcap/man.loai_ket_qua_can_lam_sang`, `ketquacanlamsangcap.nlr/plr`, `nhatkyuashangngay.diem_uas_ngay/ngay_bat_dau_chu_ky`, `nhatkyaashangngay.diem_aas_ngay`, `sanglocbaodongdo.co_nguy_co_phan_ve/ket_qua_dieu_huong`.

Khuyến nghị: DTO ghi tuyệt đối không có các field này; repository dùng kiểu `Omit<..., GeneratedKeys>` (hoặc `Prisma.XxxUncheckedCreateInput` đã lọc) để TypeScript chặn, vì Prisma sẽ không chặn. Đọc lại giá trị generated từ kết quả `create`/`update` (không tự tính lại ở app để khỏi lệch). Bỏ default literal của `loai_*` (2.2).

### g) View `v_chukytheodoiuas7`

- Mặc định (không bật preview): **không introspect**, không có model; client không có `prisma.v_chukytheodoiuas7`.
- `$queryRaw`SELECT * FROM v_chukytheodoiuas7`` chạy tốt (đã có dữ liệu thử): `so_ngay_hop_le` về `number` (smallint), `ma_*` là `bigint`, date là `Date`.
- Bật `previewFeatures = ["views"]` trong generator thì `db pull` sinh khối `view v_chukytheodoiuas7 { ma_chu_ky BigInt? ... so_ngay_hop_le Int? @db.SmallInt }` (mọi cột optional, không có `@id`), và `prisma.v_chukytheodoiuas7.findMany({ where: { so_ngay_hop_le: { gte: 0 } } })` chạy được (đã generate+chạy trong `pull-views/`, schema ở `schema.with-view.pulled.prisma`). Chỉ đọc, không có create/update.

Khuyến nghị: nếu cần dùng view này, bật `views` preview (đỡ raw) hoặc dùng `$queryRaw` có kiểu; bản trong dự án hiện chưa bật `partialIndexes`/`views` thì phải khai báo (db pull tự thêm `partialIndexes`).

### h) Mất kết nối - hình dạng lỗi (cho map 9902)

Trỏ client `PrismaPg` vào `127.0.0.1:1` (có / không `connectionTimeoutMillis`, cùng kết quả, từ chối tức thì):

| Thao tác | class | code | `meta.driverAdapterError.cause` |
|---|---|---|---|
| `nguoi.findFirst()` | PrismaClientKnownRequestError | **P1001** | `{ kind: "DatabaseNotReachable", host: "127.0.0.1", port: 1 }` |
| `$queryRaw\`SELECT 1\`` | PrismaClientKnownRequestError | **P2010** | cùng `DatabaseNotReachable` (message "Can't reach database server at 127.0.0.1:1") |
| `$transaction(async tx => ...)` | PrismaClientKnownRequestError | **P1001** | cùng, message "Can't reach database server at 127.0.0.1:1" |
| `$transaction([ ... ])` | PrismaClientKnownRequestError | **P1001** | cùng |

Khác biệt với MySQL hiện tại: không còn `P2028` ("Unable to start a transaction in the given time") khi DB tắt; transaction cũng ra P1001. Nhưng `$queryRaw` ra **P2010** (không nằm trong `PRISMA_CONNECTION_CODES` hiện tại) và nhánh `cause.kind === 'mysql'` sẽ không khớp. Phải nhận diện bằng `meta.driverAdapterError.cause.kind === 'DatabaseNotReachable'` (kind do adapter chuẩn hoá, không phụ thuộc DB).

Các trường hợp liên quan đã thử:
- Sai mật khẩu: `P1000`, `cause.kind = "AuthenticationFailed"`, `originalCode 28P01`. DB không tồn tại: `P1003`, `cause.kind = "DatabaseDoesNotExist"`, `3D000`. (cấu hình, không phải "DB down", nhưng cũng nên map 9902.)
- **Kết nối bị ngắt giữa chừng** (`pg_terminate_backend`) khi pool idle hoặc đang trong interactive tx: `P2039`, `cause: { kind: "postgres", code/originalCode: "57P01", severity: "FATAL", message: "terminating connection due to administrator command" }`. Lần query ngay sau đó thành công (pool tự phục hồi). Hàm `isDatabaseConnectionError` hiện tại sẽ **không** coi đây là lỗi kết nối.
- Hết thời gian câu lệnh (`statement_timeout`): `P2010`, `57014` ("canceling statement due to statement timeout").

Đề xuất hàm (thay thế nhánh MySQL):
```ts
const DOWN_KINDS = new Set(['DatabaseNotReachable', 'ConnectionClosed', 'TooManyConnections',
  'DatabaseDoesNotExist', 'AuthenticationFailed', 'SocketTimeout']);   // kiểm bằng log thật rồi chốt danh sách
const PG_DOWN_SQLSTATE = /^(08|57P0[123])/;    // 08xxx connection exception, 57P01 admin_shutdown, 57P02 crash, 57P03 cannot_connect_now
function driverCause(e: unknown) {
  const x = e as any;
  return x?.meta?.driverAdapterError?.cause ?? (x?.name === 'DriverAdapterError' ? x.cause : undefined);
}
isDatabaseConnectionError = e => e instanceof PrismaClientInitializationError
  || ['P1000','P1001','P1002','P1003','P1008','P1017'].includes(e?.code)
  || DOWN_KINDS.has(driverCause(e)?.kind)
  || PG_DOWN_SQLSTATE.test(String(driverCause(e)?.originalCode ?? driverCause(e)?.code ?? ''));
```
(Đã quan sát thật: `DatabaseNotReachable`, `AuthenticationFailed`, `DatabaseDoesNotExist`, SQLSTATE `57P01`; các `kind` khác trong tập là suy đoán theo `@prisma/driver-adapter-utils`, cần test lại trước khi tin.)

## 4. Trigger, function, default tự động mà người dùng Prisma cần biết

Hàm (schema `public`): chỉ 2.
- `fn_cap_nhat_thoi_gian(['protect_tao'])`: `BEFORE UPDATE` đặt `thoi_diem_cap_nhat := clock_timestamp()`; với tham số `protect_tao` còn ép `thoi_diem_tao := OLD.thoi_diem_tao` (ghi đè giá trị client gửi; đã kiểm: update `nguoi` với `thoi_diem_tao` năm 2000 vẫn giữ giá trị cũ, `thoi_diem_cap_nhat` tự đổi). Gắn vào 20 trigger `BEFORE UPDATE` trên: `anhchuptonthuong`, `benhanmaydaycap`, `chukytheodoiuas7`, `dauhieusinhton`, `donthuoc`, `dottonthuongda`, `ketquacanlamsang`, `ketquaproms`, `loainghiemphap`, `nguoi`, `nhatkyaashangngay`, `nhatkyuashangngay`, `phiennghiemphapkichthich`, `quyenhan`, `sanglocbaodongdo`, `taikhoan`, `tepdinhkem`, `thuoc`, `vaitro`, `vitritonthuong`. Bảng không có trigger (vd `hosobenhan`, `phienkham`, `benhnhan`) **không** tự cập nhật thời gian; hosobenhan cũng không có cột `thoi_diem_cap_nhat`.
- `fn_cap_nhat_cha_kqcls()`: `AFTER INSERT OR UPDATE` trên `ketquacanlamsangcap` và `ketquacanlamsangman` chạy `UPDATE ketquacanlamsang SET thoi_diem_cap_nhat = clock_timestamp() WHERE ma_ket_qua_can_lam_sang = NEW.ma_ket_qua_can_lam_sang`: ghi/sửa subtype sẽ tự chạm bảng cha (sẽ kích tiếp `trg_kqcls_cap_nhat`).
- Không có constraint trigger/trigger bắt buộc subtype; việc đó do 10 FK deferrable (mục c).

Hệ quả cho Prisma:
- **Không dùng `@updatedAt`** (DB lo); khi `create`, Prisma vẫn gửi `thoi_diem_tao`/`thoi_diem_cap_nhat` do `@default(now())` được Prisma tính ở phía client (đã thấy trong SQL log: `INSERT ... ("ho_ten","so_dien_thoai","thoi_diem_tao","thoi_diem_cap_nhat") VALUES ($1..$4)`), nên giờ ở INSERT là giờ app server, còn UPDATE là giờ DB (`clock_timestamp()`). Lệch đồng hồ app/DB có thể làm CHECK `thoi_diem_cap_nhat >= thoi_diem_tao` (`ck_nguoi_thoi_gian`...) lỗi ở vài ms. Nếu muốn dùng giờ DB cho INSERT thì đổi `@default(now())` thành `@default(dbgenerated("CURRENT_TIMESTAMP"))` trong bước patch.
- Update làm thay đổi `thoi_diem_cap_nhat` nên dữ liệu trả về từ `update()` đã phản ánh giá trị mới (RETURNING).

Default/identity/ràng buộc cần lưu ý:
- Mọi PK `ma_*` là `GENERATED ALWAYS AS IDENTITY` (33 cột): ghi id tường minh (seed/import) sẽ bị Postgres từ chối (cần `OVERRIDING SYSTEM VALUE`, Prisma không hỗ trợ). Pull sinh `@default(autoincrement())` (đúng). Seed dữ liệu có khoá cố định phải qua raw SQL; các bảng subtype dùng PK = id cha (không identity) nên ghi tường minh.
- Default trong DB (Prisma tôn trọng, không gửi): `hosobenhan.trang_thai='draft'`, `donthuoc.trang_thai_don='DANG_DIEU_TRI'`, `donthuoc.ngay_ke_don=CURRENT_DATE`, `chukytheodoiuas7.trang_thai_chu_ky='DANG_THEO_DOI'`, `nhatkyuashangngay.trang_thai_ngay='HOP_LE'`, `taikhoan.trang_thai_hoat_dong=true`, `chinhanh.trang_thai=true`, `sanglocbaodongdo.phien_ban_bo_cau_hoi='APP_GD1_V1'`, `sanglocbaodongdo.da_nhan_nut_goi_cap_cuu=false`, `sanglocbaodongdo.ma_phien_ung_dung=gen_random_uuid()`, `danhgiamucdohoatdongbenh.du_du_lieu_7_ngay=true`, các `la_can_nguyen_khac=false`, `nhatkyaashangngay.co_dot_sung_phu=false`. Cột `UUID` về `string`.
- Enum không tồn tại: mọi tập giá trị (`trang_thai`, `loai_benh_an`, `muc_dich`...) là `TEXT/VARCHAR + CHECK`, nên Prisma sinh `String` (không có enum TypeScript). Ta phải tự khai báo union type/const ở API và đồng bộ với CHECK (`hosobenhan.trang_thai` in `draft|pending|in_progress|completed|cancelled`, `gioi_tinh` in `Nam|Nu`, `tien_su_gia_dinh` in `Co|Khong|Khong ro`...).
- Khóa ngoại có `onDelete: Restrict` (ON DELETE RESTRICT) trên hầu hết quan hệ: xoá cha còn con -> `P2003`.
- Ràng buộc "ghi rõ khi chọn khác" (vd `ck_detail_*`, `ck_hoso_giadinh_detail`): trường `*_ghi_ro` phải NOT NULL khi cờ = true và phải NULL khi cờ = false/NULL; app phải xoá `*_ghi_ro` khi cờ tắt, nếu không CHECK sẽ báo lỗi 23514.
- Cột `hosobenhan.loai_benh_an` là cột không đổi thực tế (đổi sẽ vỡ FK subtype).

## 5. Tóm tắt khuyến nghị cho lớp truy cập dữ liệu

1. Quy trình schema: `db pull` -> script patch (`@@unique` 6 bảng subtype, bỏ 6 `@default` literal của `loai_*`, bật `views` nếu cần) -> `generate`. Giữ script patch và chạy tự động; không sửa tay.
2. Chuẩn hoá lỗi qua một helper duy nhất đọc `meta.driverAdapterError.cause` hoặc `error.cause` (với `DriverAdapterError` thô thoát ra khi commit deferred FK); nhận diện bằng `kind`/`originalCode`/`constraint.index`, không dựa vào `error.code`. CHECK chỉ có thể nhận diện qua SQLSTATE 23514 + tên trong message.
3. Ghi dữ liệu hồ sơ/phiên/KQ CLS luôn trong `$transaction` interactive (cha + subtype); đọc dữ liệu generated từ kết quả trả về.
4. BIGINT: chọn một chiến lược chuỗi hoá id ở biên API (không patch `BigInt.prototype`).
5. INTERVAL: repository riêng dùng `$queryRaw`/`$executeRaw` với `::interval` / `extract(epoch ...)`.
6. Login/tìm username: `$queryRaw` với `lower()`, không dùng `mode: 'insensitive'` (wildcard + không dùng index).
7. Map 9902: thêm `kind === 'DatabaseNotReachable'` và SQLSTATE `08*`/`57P0x`; bỏ nhánh `mysql` và P2028-theo-thông-điệp cho Postgres.
