import { describe, expect, it } from 'vitest';
import {
  checkImageBatch,
  checkImageFile,
  imageExtension,
  mediaFileUrl,
  normalizeImageMime,
  resolveMediaUrl,
  uploadFileName,
} from './media.js';
import { MEDIA_MAX_FILE_BYTES, MEDIA_PATHS } from './contracts/media.js';

const validImage = { mimeType: 'image/jpeg', size: 1024 };

describe('normalizeImageMime', () => {
  it('giữ MIME ảnh hợp lệ và chuẩn hoá hoa thường, khoảng trắng, image/jpg', () => {
    expect(normalizeImageMime('image/jpeg')).toBe('image/jpeg');
    expect(normalizeImageMime('IMAGE/PNG')).toBe('image/png');
    expect(normalizeImageMime(' image/webp ')).toBe('image/webp');
    expect(normalizeImageMime('image/jpg')).toBe('image/jpeg');
  });

  it('trả null cho định dạng ngoài danh sách hoặc giá trị rỗng', () => {
    expect(normalizeImageMime('image/heic')).toBeNull();
    expect(normalizeImageMime('image/gif')).toBeNull();
    expect(normalizeImageMime('video/mp4')).toBeNull();
    expect(normalizeImageMime('')).toBeNull();
    expect(normalizeImageMime(null)).toBeNull();
    expect(normalizeImageMime(undefined)).toBeNull();
  });
});

describe('checkImageFile', () => {
  it('chấp nhận tệp đúng bằng giới hạn dung lượng', () => {
    expect(checkImageFile({ mimeType: 'image/jpeg', size: MEDIA_MAX_FILE_BYTES })).toBeNull();
  });

  it('trả 6003 khi vượt giới hạn dung lượng', () => {
    expect(checkImageFile({ mimeType: 'image/jpeg', size: MEDIA_MAX_FILE_BYTES + 1 })).toBe('6003');
  });

  it('trả 6002 khi MIME không phải ảnh được hỗ trợ', () => {
    expect(checkImageFile({ mimeType: 'image/heic', size: 100 })).toBe('6002');
  });

  it('bỏ qua kiểm tra dung lượng khi không biết kích thước', () => {
    expect(checkImageFile({ mimeType: 'image/png' })).toBeNull();
  });

  it('trả 6001 khi tệp rỗng', () => {
    expect(checkImageFile({ mimeType: 'image/png', size: 0 })).toBe('6001');
  });
});

describe('checkImageBatch', () => {
  it('trả 6001 khi không có tệp nào', () => {
    expect(checkImageBatch([])).toBe('6001');
  });

  it('trả 6004 khi quá 10 tệp', () => {
    const files = Array.from({ length: 11 }, () => validImage);
    expect(checkImageBatch(files)).toBe('6004');
  });

  it('chấp nhận đúng 10 tệp hợp lệ', () => {
    const files = Array.from({ length: 10 }, () => validImage);
    expect(checkImageBatch(files)).toBeNull();
  });

  it('trả lỗi của tệp không hợp lệ đầu tiên', () => {
    expect(checkImageBatch([validImage, { mimeType: 'image/gif', size: 10 }])).toBe('6002');
  });
});

describe('imageExtension', () => {
  it('trả phần mở rộng tương ứng với MIME', () => {
    expect(imageExtension('image/jpeg')).toBe('jpg');
    expect(imageExtension('image/png')).toBe('png');
    expect(imageExtension('image/webp')).toBe('webp');
  });
});

describe('mediaFileUrl', () => {
  it('ghép file_url theo id số hoặc chuỗi', () => {
    expect(mediaFileUrl(12)).toBe('/api/v1/image-attachments/view/12');
    expect(mediaFileUrl('7')).toBe('/api/v1/image-attachments/view/7');
  });
});

describe('resolveMediaUrl', () => {
  it('ghép địa chỉ gốc với đường dẫn tương đối, bỏ dấu / thừa cuối base', () => {
    expect(resolveMediaUrl('http://localhost:3000/', '/api/v1/image-attachments/view/1')).toBe(
      'http://localhost:3000/api/v1/image-attachments/view/1',
    );
  });

  it('thêm dấu / khi đường dẫn thiếu dấu /', () => {
    expect(resolveMediaUrl('http://10.0.0.2:3000', 'api/v1/x')).toBe(
      'http://10.0.0.2:3000/api/v1/x',
    );
  });

  it('giữ URL tuyệt đối cùng origin với API (không phân biệt hoa thường, cổng mặc định)', () => {
    const view = '/api/v1/image-attachments/view/1';
    expect(resolveMediaUrl('http://localhost:3000', `http://localhost:3000${view}`)).toBe(
      `http://localhost:3000${view}`,
    );
    expect(resolveMediaUrl('https://api.example.vn/', `HTTPS://API.example.vn:443${view}`)).toBe(
      `HTTPS://API.example.vn:443${view}`,
    );
  });

  it('từ chối URL tuyệt đối tới origin khác (khác host, cổng hoặc scheme)', () => {
    expect(resolveMediaUrl('http://localhost:3000', 'https://cdn.example.com/a.jpg')).toBeNull();
    expect(resolveMediaUrl('http://localhost:3000', 'http://localhost:3001/a.jpg')).toBeNull();
    expect(resolveMediaUrl('http://localhost:3000', 'https://localhost:3000/a.jpg')).toBeNull();
    expect(resolveMediaUrl('http://localhost:3000', 'http://localhost:3000@evil.com/a')).toBeNull();
    expect(resolveMediaUrl('http://localhost:3000', 'http://localhost:3000\\@evil.com')).toBeNull();
  });

  it('từ chối protocol-relative (//host) và scheme khác http(s)', () => {
    expect(resolveMediaUrl('http://localhost:3000', '//evil.com/a.jpg')).toBeNull();
    expect(resolveMediaUrl('http://localhost:3000', '/\\evil.com/a.jpg')).toBeNull();
    expect(resolveMediaUrl('http://localhost:3000', 'javascript:alert(1)')).toBeNull();
    expect(resolveMediaUrl('http://localhost:3000', ' JavaScript:alert(1)')).toBeNull();
    expect(resolveMediaUrl('http://localhost:3000', 'data:image/png;base64,AAAA')).toBeNull();
    expect(resolveMediaUrl('http://localhost:3000', 'blob:http://localhost:3000/x')).toBeNull();
    expect(resolveMediaUrl('http://localhost:3000', 'http:/evil.com/a.jpg')).toBeNull();
  });

  it('từ chối URL tuyệt đối khi địa chỉ API không phải http(s) hợp lệ', () => {
    expect(resolveMediaUrl('', 'http://localhost:3000/a.jpg')).toBeNull();
  });
});

describe('MEDIA_PATHS', () => {
  it('ghép đường dẫn theo id', () => {
    expect(MEDIA_PATHS.byUser(5)).toBe('/image-attachments/user/5');
    expect(MEDIA_PATHS.answerImagesOf('3')).toBe('/answer-images/3');
  });
});

describe('uploadFileName', () => {
  it('đổi đuôi theo MIME (HEIC đã chuyển JPEG thành .jpg)', () => {
    expect(uploadFileName('IMG_001.HEIC', 'image/jpeg')).toBe('IMG_001.jpg');
    expect(uploadFileName('a.b.png', 'image/webp')).toBe('a.b.webp');
  });

  it('thêm đuôi khi tên không có đuôi và dùng "anh" khi tên rỗng', () => {
    expect(uploadFileName('photo', 'image/png')).toBe('photo.png');
    expect(uploadFileName('  ', 'image/jpeg')).toBe('anh.jpg');
    expect(uploadFileName('.jpg', 'image/jpeg')).toBe('anh.jpg');
  });
});
