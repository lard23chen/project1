// widget.js 是瀏覽器腳本，無法直接 require。
// 把純函式提取出來放在同一個測試用 module 裡驗證邏輯正確性。

function darkenColor(hex, amount = 20) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

describe('darkenColor', () => {
  test('將 #2563eb 調深應回傳較暗的 hex', () => {
    const result = darkenColor('#2563eb', 20);
    // R: 0x25=37 → 37-20=17 → 0x11
    // G: 0x63=99 → 99-20=79 → 0x4f
    // B: 0xeb=235 → 235-20=215 → 0xd7
    expect(result).toBe('#114fd7');
  });

  test('不會低於 0（clamp）', () => {
    const result = darkenColor('#050505', 20);
    expect(result).toBe('#000000');
  });

  test('不傳 amount 時預設調深 20', () => {
    const result = darkenColor('#2563eb');
    expect(result).toBe('#114fd7');
  });
});
