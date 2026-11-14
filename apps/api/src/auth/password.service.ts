import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

/** Cost 10: hash dạng `$2…`, tương thích bcrypt nếu nhóm DB đã seed sẵn dữ liệu. */
const BCRYPT_COST = 10;

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_COST);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
