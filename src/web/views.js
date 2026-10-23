const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STATUS = {
  pending_approval: ['รออนุมัติ', 'warn'],
  approved: ['อนุมัติแล้ว รอเวลาโพสต์', 'info'],
  published: ['โพสต์ลงเพจแล้ว', 'ok'],
  failed: ['โพสต์ไม่สำเร็จ', 'bad'],
  skipped: ['ข้าม', 'mute'],
};
const ITEM = {
  waiting: ['รอโพสต์เพจก่อน', 'mute'],
  queued: ['พร้อมโพสต์', 'warn'],
  done: ['โพสต์แล้ว', 'ok'],
  skipped: ['ข้าม', 'mute'],
  expired: ['หมดอายุ', 'mute'],
};
const MODE = { promo: 'โปรโมท', soft: 'ไม่ขาย (ปรับจากโปรโมท)', value: 'ให้ความรู้/สนุก' };

const badge = ([text, tone]) => `<span class="badge ${tone}">${esc(text)}</span>`;
const btn = (action, label, tone = '') => `<form method="post" action="${action}"><button class="${tone}">${esc(label)}</button></form>`;

function layout(title, body) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{--bg:#0d0f12;--panel:#15181d;--line:#272b33;--text:#f2ece1;--muted:#8d939c;--mint:#5fe3b3;--warn:#f0b45a;--bad:#ef6f6c;--info:#7fb2ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 'IBM Plex Sans Thai','Noto Sans Thai',system-ui,sans-serif}
a{color:var(--mint)}header{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:16px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:2}
header h1{font-size:18px;margin:0 auto 0 0;letter-spacing:.08em}main{max-width:960px;margin:0 auto;padding:16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:20px}
.head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.head h2{font-size:18px;margin:0 auto 0 0}
.badge{font-size:13px;padding:2px 10px;border-radius:99px;border:1px solid currentColor;white-space:nowrap}
.ok{color:var(--mint)}.warn{color:var(--warn)}.bad{color:var(--bad)}.info{color:var(--info)}.mute{color:var(--muted)}
.post{display:grid;grid-template-columns:minmax(0,280px) 1fr;gap:16px}@media(max-width:700px){.post{grid-template-columns:1fr}}
.post img{width:100%;border-radius:6px;border:1px solid var(--line)}
pre,textarea{white-space:pre-wrap;word-break:break-word;background:#0b0d10;border:1px solid var(--line);border-radius:6px;padding:12px;margin:0;color:var(--text);font:inherit;font-size:15px;width:100%}
textarea{min-height:180px;resize:vertical}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.actions form{margin:0}
button,.button{font:inherit;font-size:14px;background:#20242b;color:var(--text);border:1px solid var(--line);border-radius:6px;padding:8px 14px;cursor:pointer;text-decoration:none;display:inline-block}
button.primary,.button.primary{background:var(--mint);color:#08100c;border-color:var(--mint);font-weight:600}
button.danger{color:var(--bad)}
.items{margin-top:16px;display:grid;gap:12px}.item{border:1px solid var(--line);border-radius:8px;padding:12px}
.item.done,.item.skipped,.item.expired{opacity:.55}.item h3{font-size:16px;margin:0 auto 0 0}
.muted{color:var(--muted);font-size:14px}.empty{padding:40px;text-align:center;color:var(--muted)}
.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--mint);color:#08100c;padding:8px 16px;border-radius:6px;display:none}
</style></head><body>${body}<div class="toast" id="toast">คัดลอกแล้ว</div>
<script>
async function copyText(id){const el=document.getElementById(id);const t=el.value??el.textContent;
try{await navigator.clipboard.writeText(t)}catch{el.select?.();document.execCommand('copy')}
const s=document.getElementById('toast');s.style.display='block';setTimeout(()=>s.style.display='none',1200)}
</script></body></html>`;
}

export function renderLogin(error = '') {
  return layout('Strata · เข้าสู่ระบบ', `<main style="max-width:360px;margin-top:12vh">
    <div class="card"><h2 style="margin-top:0">Strata Automation</h2>
    ${error ? `<p class="bad">${esc(error)}</p>` : ''}
    <form method="post" action="/login"><input type="password" name="password" placeholder="รหัสผ่าน" autofocus
      style="width:100%;padding:10px;border-radius:6px;border:1px solid var(--line);background:#0b0d10;color:var(--text);font:inherit">
    <div class="actions"><button class="primary">เข้าสู่ระบบ</button></div></form></div></main>`);
}

function renderItem(item, post, group) {
  const img = item.mode === 'soft' && post.softImageUrl ? post.softImageUrl : post.imageUrl;
  const open = item.status === 'queued' || item.status === 'waiting';
  return `<div class="item ${item.status}" id="item-${item.id}">
    <div class="head"><h3>${esc(group?.name ?? item.group_id)}</h3>${badge([MODE[item.mode], 'info'])}${badge(ITEM[item.status])}</div>
    ${group?.rules ? `<p class="muted">กฎกลุ่ม: ${esc(group.rules)}</p>` : ''}
    <textarea id="t-${item.id}" readonly>${esc(item.text)}</textarea>
    <div class="actions">
      <button type="button" class="primary" onclick="copyText('t-${item.id}')">คัดลอกข้อความ</button>
      <a class="button" href="${img}" download="strata-${post.date}-${post.slot}-${item.group_id}.png">ดาวน์โหลดภาพ</a>
      ${post.permalink ? `<input type="hidden" id="l-${item.id}" value="${esc(post.permalink)}"><button type="button" onclick="copyText('l-${item.id}')">คัดลอกลิงก์โพสต์เพจ</button>` : ''}
      ${group?.url ? `<a class="button" href="${esc(group.url)}" target="_blank" rel="noopener">เปิดกลุ่ม ↗</a>` : ''}
      ${open ? btn(`/item/${item.id}/done`, 'โพสต์แล้ว ✓') + btn(`/item/${item.id}/skip`, 'ข้าม') : btn(`/item/${item.id}/undo`, 'ย้อนกลับ')}
    </div></div>`;
}

function renderPost(post, groups, slotLabel, requireApproval) {
  const actions = [];
  if (post.status === 'pending_approval') actions.push(btn(`/post/${post.id}/approve`, 'อนุมัติ (โพสต์ตามเวลา)', 'primary'));
  if (['pending_approval', 'approved', 'failed'].includes(post.status)) actions.push(btn(`/post/${post.id}/publish`, post.status === 'failed' ? 'ลองโพสต์อีกครั้ง' : 'โพสต์ลงเพจทันที'));
  if (!['published', 'skipped'].includes(post.status)) actions.push(btn(`/post/${post.id}/skip`, 'ข้ามโพสต์นี้', 'danger'));
  const groupOf = (id) => groups.find((g) => g.id === id);
  return `<section class="card">
    <div class="head"><h2>${esc(slotLabel[post.slot])} · ${esc(post.topic)}</h2>
      ${badge([post.pillar + (post.is_promo ? ' · โปรโมท' : ''), 'info'])}${badge(STATUS[post.status] ?? [post.status, 'mute'])}</div>
    <div class="post">
      <div><img src="${post.imageUrl}" alt="">${post.softImageUrl ? `<p class="muted">ภาพแบบไม่ขาย (กลุ่มที่ห้ามขาย)</p><img src="${post.softImageUrl}" alt="">` : ''}</div>
      <div><pre id="c-${post.id}">${esc(post.caption)}</pre>
        ${post.error ? `<p class="bad">${esc(post.error)}</p>` : ''}
        ${post.permalink ? `<p><a href="${esc(post.permalink)}" target="_blank" rel="noopener">ดูโพสต์บนเพจ ↗</a></p>` : ''}
        <div class="actions">${actions.join('')}<button type="button" onclick="copyText('c-${post.id}')">คัดลอกแคปชัน</button></div>
        ${requireApproval && post.status === 'pending_approval' ? '<p class="muted">โหมดอนุมัติเปิดอยู่: ถ้าไม่อนุมัติก่อนเวลา ระบบจะไม่โพสต์</p>' : ''}
      </div>
    </div>
    ${post.items.length ? `<div class="items">${post.items.map((it) => renderItem(it, post, groupOf(it.group_id))).join('')}</div>` : ''}
  </section>`;
}

export function renderDay({ date, prev, next, isToday, posts, groups, slotLabel, requireApproval }) {
  const pending = posts.reduce((n, p) => n + p.items.filter((i) => i.status === 'queued').length, 0);
  return layout(`Strata · ${date}`, `<header><h1>STRATA · คิวโพสต์</h1>
      <a class="button" href="/?date=${prev}">‹</a><strong>${date}${isToday ? ' (วันนี้)' : ''}</strong><a class="button" href="/?date=${next}">›</a>
      ${pending ? badge([`รอโพสต์ในกลุ่ม ${pending}`, 'warn']) : ''}</header>
    <main>${posts.length ? posts.map((p) => renderPost(p, groups, slotLabel, requireApproval)).join('') : '<div class="empty">ยังไม่มีโพสต์ของวันนี้</div>'}</main>`);
}
