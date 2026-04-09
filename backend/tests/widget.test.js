// widget.js 是瀏覽器腳本，無法直接 require。
// 把純函式提取出來放在同一個測試用 module 裡驗證邏輯正確性。

// darkenColor is duplicated from backend/public/widget.js (browser IIFE cannot be required).
// If you update the algorithm in widget.js, update this copy too.
function darkenColor(hex, amount = 20) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex || '#2563eb';
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

const DEFAULTS = {
  color: '#2563eb',
  title: '智能客服',
  icon: '💬',
  welcome: '您好！我是智能客服，有什麼可以協助您的嗎？',
  open: false,
  position: 'right',
  lang: 'zh',
};

// parseConfig is duplicated from backend/public/widget.js (browser IIFE cannot be required).
// If you update the algorithm in widget.js, update this copy too.
function parseConfig(dataset, defaults) {
  const lang = dataset.lang || defaults.lang;
  const enDefaults = { title: 'Support', welcome: 'Hi! How can I help you?' }; // English locale fallbacks
  return {
    color:    dataset.color    || defaults.color,
    title:    dataset.title    || (lang === 'en' ? enDefaults.title : defaults.title),
    icon:     dataset.icon     || defaults.icon,
    welcome:  dataset.welcome  || (lang === 'en' ? enDefaults.welcome : defaults.welcome),
    open:     dataset.open !== undefined ? dataset.open === 'true' : defaults.open,
    position: dataset.position || defaults.position,
    lang,
  };
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

  test('只有部分通道 clamp 時其他通道正常調深', () => {
    // R: 0x30=48 → 48-20=28 → 0x1c
    // G: 0x00=0  → 0-20 clamp → 0x00
    // B: 0x14=20 → 20-20=0   → 0x00
    const result = darkenColor('#300014', 20);
    expect(result).toBe('#1c0000');
  });
});

describe('parseConfig', () => {
  test('無任何 data-* 時全部使用預設值', () => {
    const cfg = parseConfig({}, DEFAULTS);
    expect(cfg).toEqual(DEFAULTS);
  });

  test('data-color 覆蓋預設色', () => {
    const cfg = parseConfig({ color: '#e91e63' }, DEFAULTS);
    expect(cfg.color).toBe('#e91e63');
  });

  test('data-open="true" 解析為 boolean true', () => {
    const cfg = parseConfig({ open: 'true' }, DEFAULTS);
    expect(cfg.open).toBe(true);
  });

  test('data-open="false" 解析為 boolean false', () => {
    const cfg = parseConfig({ open: 'false' }, DEFAULTS);
    expect(cfg.open).toBe(false);
  });

  test('data-open 未設定時使用 defaults.open', () => {
    const customDefaults = { ...DEFAULTS, open: true };
    const cfg = parseConfig({}, customDefaults);
    expect(cfg.open).toBe(true);
  });

  test('data-lang="en" 時 title/welcome 使用英文預設', () => {
    const cfg = parseConfig({ lang: 'en' }, DEFAULTS);
    expect(cfg.title).toBe('Support');
    expect(cfg.lang).toBe('en');
  });

  test('data-lang="en" 但同時有 data-title 時優先用 data-title', () => {
    const cfg = parseConfig({ lang: 'en', title: 'ibon Help' }, DEFAULTS);
    expect(cfg.title).toBe('ibon Help');
  });
});
