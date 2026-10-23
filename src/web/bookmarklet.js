// ปุ่ม "เก็บรายชื่อกลุ่ม" (bookmarklet) — ผู้ใช้กดเองบนหน้า facebook.com/groups/joins/ ในเบราว์เซอร์ของตัวเอง
// อ่านเฉพาะลิงก์กลุ่มที่แสดงอยู่บนหน้า ไม่ส่งข้อมูลไปที่ไหน แค่แสดงเป็น JSON ให้กดคัดลอกไปวางใน Dashboard
function collect() {
  /* global document, window, location */
  if (!/facebook\.com$/.test(location.hostname.replace(/^(www|web|m)\./, ''))) {
    alert('เปิดหน้า facebook.com/groups/joins/ (กลุ่มของคุณ) ก่อน แล้วค่อยกดปุ่มนี้');
    return;
  }
  const SKIP = /^(joins|feed|discover|create|search|notifications)$/i;
  const grab = () => {
    const map = new Map();
    for (const a of document.querySelectorAll('a[href*="/groups/"]')) {
      const m = a.href.match(/facebook\.com\/groups\/([A-Za-z0-9._-]+)/);
      if (!m || SKIP.test(m[1])) continue;
      // ชื่อกลุ่ม = ข้อความชิ้นแรกในลิงก์ (การ์ดกลุ่มมักมีข้อความอื่นต่อท้าย เช่น "อัปเดตล่าสุด…")
      const leaf = [...a.querySelectorAll('*')].find((el) => !el.children.length && el.textContent.trim());
      const name = ((leaf && leaf.textContent) || a.getAttribute('aria-label') || a.innerText || '')
        .split('\n').map((s) => s.trim()).find(Boolean) || '';
      const url = `https://www.facebook.com/groups/${m[1]}/`;
      const prev = map.get(url);
      if (!prev || (!prev.name && name)) map.set(url, { name, url });
    }
    return [...map.values()];
  };
  let last = -1;
  let rounds = 0;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;top:16px;right:16px;width:380px;max-width:90vw;background:#15181d;color:#f2ece1;border:1px solid #5fe3b3;border-radius:10px;padding:14px;font:14px system-ui,sans-serif;box-shadow:0 8px 30px #0008';
  box.textContent = 'กำลังเลื่อนหน้าเพื่อโหลดกลุ่มทั้งหมด…';
  document.body.appendChild(box);
  const step = () => {
    const n = grab().length;
    if (n === last || rounds >= 25) return done();
    last = n;
    rounds += 1;
    box.textContent = `กำลังโหลดกลุ่ม… เจอแล้ว ${n} กลุ่ม`;
    window.scrollTo(0, document.body.scrollHeight);
    setTimeout(step, 1200);
  };
  const done = () => {
    const list = grab();
    box.innerHTML = '';
    const h = document.createElement('div');
    h.textContent = `เจอ ${list.length} กลุ่ม — กดคัดลอก แล้วไปวางที่หน้า "นำเข้ากลุ่ม" ใน Strata Dashboard`;
    const ta = document.createElement('textarea');
    ta.value = JSON.stringify(list);
    ta.style.cssText = 'width:100%;height:120px;margin:10px 0;background:#0b0d10;color:#f2ece1;border:1px solid #272b33;border-radius:6px';
    const copy = document.createElement('button');
    copy.textContent = 'คัดลอก';
    copy.style.cssText = 'background:#5fe3b3;color:#08100c;border:0;border-radius:6px;padding:8px 14px;font-weight:600;cursor:pointer;margin-right:8px';
    copy.onclick = () => {
      ta.select();
      (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).catch(() => document.execCommand('copy'));
      copy.textContent = 'คัดลอกแล้ว ✓';
    };
    const close = document.createElement('button');
    close.textContent = 'ปิด';
    close.style.cssText = 'background:#20242b;color:#f2ece1;border:1px solid #272b33;border-radius:6px;padding:8px 14px;cursor:pointer';
    close.onclick = () => box.remove();
    box.append(h, ta, copy, close);
  };
  step();
}

export const BOOKMARKLET = `javascript:${encodeURIComponent(`(${collect.toString()})();void 0`)}`;
