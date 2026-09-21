import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

const srcBytes = fs.readFileSync('ref/ssen_problems.pdf');
const srcDoc = await PDFDocument.load(srcBytes);
const totalPages = srcDoc.getPageCount();
console.log(`Source total pages: ${totalPages}`);

// Pages are 1-indexed in user spec; pdf-lib is 0-indexed
const ranges = [
  { name: 'c1_p32-34',   start: 32, end: 34 },
  { name: 'c2_p44-45',   start: 44, end: 45 },
  { name: 'c3_p58-59',   start: 58, end: 59 },
  { name: 'c4_p72-73',   start: 72, end: 73 },
  { name: 'c5_p93-95',   start: 93, end: 95 },
  { name: 'c6_p111-113', start: 111, end: 113 },
  { name: 'c7_p125-126', start: 125, end: 126 },
];

if (!fs.existsSync('ref/ssen_c')) fs.mkdirSync('ref/ssen_c');

for (const r of ranges) {
  const newDoc = await PDFDocument.create();
  const indices = [];
  for (let i = r.start - 1; i <= r.end - 1; i++) indices.push(i);
  const copied = await newDoc.copyPages(srcDoc, indices);
  copied.forEach(p => newDoc.addPage(p));
  const out = await newDoc.save();
  const outPath = `ref/ssen_c/${r.name}.pdf`;
  fs.writeFileSync(outPath, out);
  const mb = (out.length / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${outPath} (${mb} MB)`);
}
