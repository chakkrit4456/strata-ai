// ชิ้นส่วน HTML ที่ทุกหน้าใช้ร่วมกัน (layout, เมนู, ปุ่ม, ฟอร์ม)
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const badge = ([text, tone]) => `<span class="badge ${tone}">${esc(text)}</span>`;

const NAV = [
  ['/now', 'now', '⚡ สร้างและโพสต์ทันที'],
  ['/', 'queue', 'คิววันนี้'],
  ['/drafts', 'drafts', 'ร่างโพสต์'],
  ['/history', 'history', 'โพสต์/ประวัติ'],
  ['/groups', 'groups', 'กลุ่ม'],
  ['/brand', 'brand', 'แบรนด์'],
  ['/pillars', 'pillars', 'หมวดเนื้อหา'],
  ['/settings', 'settings', 'ตั้งค่า'],
  ['/logs', 'logs', 'Log'],
];

export const csrfInput = (csrf) => `<input type="hidden" name="_csrf" value="${esc(csrf)}">`;

/** ปุ่มที่ส่ง POST (ฟอร์มเล็กๆ ของตัวเอง) */
export function btn(action, label, { csrf, tone = '', confirm = '', fields = {} } = {}) {
  const hidden = Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
  return `<form method="post" action="${esc(action)}"${confirm ? ` onsubmit="return confirm(${esc(JSON.stringify(confirm))})"` : ''}>${csrfInput(csrf)}${hidden}<button class="${tone}">${esc(label)}</button></form>`;
}

export function field(label, name, value, { type = 'text', hint = '', required = false, attrs = '' } = {}) {
  return `<label class="field"><span>${esc(label)}${required ? ' *' : ''}</span>
    <input type="${type}" name="${esc(name)}" value="${esc(value)}"${required ? ' required' : ''} ${attrs}>
    ${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
}

export function area(label, name, value, { rows = 4, hint = '', required = false, mono = false } = {}) {
  return `<label class="field"><span>${esc(label)}${required ? ' *' : ''}</span>
    <textarea name="${esc(name)}" rows="${rows}"${required ? ' required' : ''}${mono ? ' class="mono"' : ''}>${esc(value)}</textarea>
    ${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
}

export function select(label, name, value, options, { hint = '' } = {}) {
  return `<label class="field"><span>${esc(label)}</span><select name="${esc(name)}">
    ${options.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(t)}</option>`).join('')}
  </select>${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
}

export const check = (label, name, checked, { value = '1' } = {}) =>
  `<label class="check"><input type="checkbox" name="${esc(name)}" value="${esc(value)}"${checked ? ' checked' : ''}> ${esc(label)}</label>`;

export const lines = (v) => String(v ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

function flashHtml(flash) {
  if (!flash) return '';
  return [flash.ok && `<div class="flash ok">${esc(flash.ok)}</div>`, flash.err && `<div class="flash bad">${esc(flash.err)}</div>`].filter(Boolean).join('');
}

export function layout({ title, active = '', body, flash, nav = true, refresh = 0 }) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${refresh ? `<meta http-equiv="refresh" content="${refresh}">` : ''}
<title>${esc(title)}</title>
<style>
:root{--bg:#0d0f12;--panel:#15181d;--line:#272b33;--text:#f2ece1;--muted:#8d939c;--mint:#5fe3b3;--warn:#f0b45a;--bad:#ef6f6c;--info:#7fb2ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 'IBM Plex Sans Thai','Noto Sans Thai',system-ui,sans-serif}
a{color:var(--mint)}
.top{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line)}
.top .bar{display:flex;align-items:center;gap:12px;padding:12px 16px;max-width:1100px;margin:0 auto}
.top .logo{font-weight:700;letter-spacing:.14em;margin-right:auto}
nav{display:flex;gap:4px;overflow-x:auto;padding:0 12px 10px;max-width:1100px;margin:0 auto;scrollbar-width:none}
nav a{white-space:nowrap;text-decoration:none;color:var(--muted);padding:6px 12px;border-radius:99px;font-size:14px}
nav a.on{background:#20242b;color:var(--text)}nav a[href="/now"]{color:var(--mint)}
.steps{margin:6px 0 0;padding-left:20px}.disabled{opacity:.5}
main{max-width:1100px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:4px 0 16px}h2{font-size:18px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:20px}
.head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.head h2{font-size:18px;margin:0 auto 0 0}
.badge{font-size:13px;padding:2px 10px;border-radius:99px;border:1px solid currentColor;white-space:nowrap}
.ok{color:var(--mint)}.warn{color:var(--warn)}.bad{color:var(--bad)}.info{color:var(--info)}.mute{color:var(--muted)}
.flash{padding:10px 14px;border-radius:8px;margin-bottom:16px;border:1px solid currentColor;background:#111418;white-space:pre-wrap}
.post{display:grid;grid-template-columns:minmax(0,280px) 1fr;gap:16px}@media(max-width:700px){.post{grid-template-columns:1fr}}
.post img,.preview{width:100%;border-radius:6px;border:1px solid var(--line)}
pre,textarea,input,select{background:#0b0d10;border:1px solid var(--line);border-radius:6px;color:var(--text);font:inherit;font-size:15px}
pre,textarea{white-space:pre-wrap;word-break:break-word;padding:12px;margin:0;width:100%}
textarea{resize:vertical}textarea.mono,.mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px}
input,select{padding:9px 10px;width:100%}input[type=checkbox]{width:auto}
.field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}.field span{font-size:14px;color:var(--muted)}.field small{color:var(--muted);font-size:13px}
.check{display:inline-flex;align-items:center;gap:6px;margin:0 14px 10px 0;font-size:15px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:0 16px}
@media(max-width:700px){.grid2,.grid3{grid-template-columns:1fr}}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;align-items:center}.actions form{margin:0}
button,.button{font:inherit;font-size:14px;background:#20242b;color:var(--text);border:1px solid var(--line);border-radius:6px;padding:8px 14px;cursor:pointer;text-decoration:none;display:inline-block}
button.primary,.button.primary{background:var(--mint);color:#08100c;border-color:var(--mint);font-weight:600}
button.danger{color:var(--bad)}button:disabled{opacity:.5;cursor:not-allowed}
.items{margin-top:16px;display:grid;gap:12px}.item{border:1px solid var(--line);border-radius:8px;padding:12px}
.item.done,.item.skipped,.item.expired{opacity:.55}.item h3{font-size:16px;margin:0 auto 0 0}
.muted{color:var(--muted);font-size:14px}.empty{padding:40px;text-align:center;color:var(--muted)}
.table{width:100%;border-collapse:collapse;font-size:15px}.table th,.table td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.table th{color:var(--muted);font-weight:500;font-size:13px}.scroll{overflow-x:auto}
details summary{cursor:pointer;color:var(--muted);margin:8px 0}
.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--mint);color:#08100c;padding:8px 16px;border-radius:6px;display:none}
</style></head><body>
${nav ? `<header class="top"><div class="bar"><span class="logo">STRATA</span><form method="post" action="/logout"><button>ออกจากระบบ</button></form></div>
<nav>${NAV.map(([href, key, label]) => `<a href="${href}" class="${key === active ? 'on' : ''}">${label}</a>`).join('')}</nav></header>` : ''}
<main>${flashHtml(flash)}${body}</main><div class="toast" id="toast">คัดลอกแล้ว</div>
<script>
async function copyText(id){const el=document.getElementById(id);const t=el.value??el.textContent;
try{await navigator.clipboard.writeText(t)}catch{el.select?.();document.execCommand('copy')}
const s=document.getElementById('toast');s.style.display='block';setTimeout(()=>s.style.display='none',1200)}
function copyOpen(id,url){const w=window.open(url,'_blank');if(w)w.opener=null;else location.href=url;copyText(id)}
</script></body></html>`;
}
