import { AppException, conflict, invalidReference, notFound } from './app.exception.js';

describe('helper lỗi 2003', () => {
  it('notFound → 2003 / 404', () => {
    expect(notFound()).toMatchObject({ code: '2003', httpStatus: 404 });
  });

  it('conflict → 2003 / 409', () => {
    expect(conflict()).toMatchObject({ code: '2003', httpStatus: 409 });
  });

  it('invalidReference → 2003 kèm tên trường, giữ HTTP status của catalog', () => {
    const error = invalidReference('branch_id');
    expect(error).toBeInstanceOf(AppException);
    expect(error).toMatchObject({ code: '2003', data: { field: 'branch_id' } });
    expect(error.httpStatus).toBeUndefined();
  });
});
