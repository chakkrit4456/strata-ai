// วัดความคล้ายของข้อความด้วย character trigram (ภาษาไทยไม่เว้นวรรคระหว่างคำ จึงใช้ระดับตัวอักษร)
const normalize = (s) => String(s).toLowerCase().replace(/https?:\/\/\S+/g, '').replace(/[\s\p{P}\p{S}]+/gu, '');

export function trigrams(s) {
  const t = normalize(s);
  const out = new Set();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}

export function similarity(a, b) {
  const A = trigrams(a);
  const B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export function maxSimilarity(text, others) {
  let best = { score: 0, index: -1 };
  others.forEach((o, i) => {
    const score = similarity(text, o);
    if (score > best.score) best = { score, index: i };
  });
  return best;
}
