// A small PDF maker: each page is one JPEG picture (drawn on a canvas), A4. No
// library needed; prints and opens everywhere (Nov 6 2026, the report for a doctor).
const A4 = { w: 595.28, h: 841.89 };

const bytesOf = (dataUrl: string): Uint8Array => {
  const b64 = dataUrl.split(",")[1];
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** JPEG data URLs (one per page, all the same pixel size) → PDF bytes. */
export const jpegsToPdf = (pages: string[], px: { w: number; h: number }): Uint8Array => {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (x: string | Uint8Array) => { const b = typeof x === "string" ? enc.encode(x) : x; chunks.push(b); len += b.length; };
  const obj = (id: number, body: (string | Uint8Array)[]) => { offsets[id] = len; push(`${id} 0 obj\n`); body.forEach(push); push("\nendobj\n"); };

  push("%PDF-1.4\n");
  const n = pages.length;
  const kids = Array.from({ length: n }, (_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2, [`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`]);
  pages.forEach((url, i) => {
    const page = 3 + i * 3, content = page + 1, image = page + 2;
    obj(page, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /XObject << /Im${i} ${image} 0 R >> >> /Contents ${content} 0 R >>`]);
    const draw = `q ${A4.w} 0 0 ${A4.h} 0 0 cm /Im${i} Do Q`;
    obj(content, [`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`]);
    const data = bytesOf(url);
    obj(image, [`<< /Type /XObject /Subtype /Image /Width ${px.w} /Height ${px.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`, data, "\nendstream"]);
  });
  const total = 2 + n * 3;
  const xref = len;
  push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= total; id++) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
};
