/** Id trong CSDL là BIGINT (`bigint` trong JS); JSON của API giữ kiểu id như contract (spec A, mục 4.3, MT-06). */
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** Id đầu vào đã được parseIdPipe/IdRule kiểm tra (số nguyên dương, không vượt MAX_ID). */
export function toDbId(id: number): bigint {
  return BigInt(id);
}

/**
 * Mọi id rời tầng dữ liệu đi qua hàm này; không vá BigInt.prototype.toJSON (spike 3d). Vượt
 * Number.MAX_SAFE_INTEGER thì ném RangeError: client nhận 9901, lỗi được ghi log.
 */
export function fromDbId(value: bigint): number {
  if (value > MAX_SAFE || value < -MAX_SAFE) {
    throw new RangeError(`Id ${value} của CSDL vượt quá số nguyên an toàn của JavaScript`);
  }
  return Number(value);
}
