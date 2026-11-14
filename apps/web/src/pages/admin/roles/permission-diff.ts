/** So sánh quyền đã gán với quyền đang chọn: cái cần gán thêm (POST) và cái cần thu hồi (DELETE). */
export function diffPermissions(assigned: number[], selected: number[]) {
  const before = new Set(assigned);
  const after = new Set(selected);
  return {
    toAdd: selected.filter((id) => !before.has(id)),
    toRemove: assigned.filter((id) => !after.has(id)),
  };
}
