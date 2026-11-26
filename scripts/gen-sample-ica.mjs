import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const NAVY = rgb(0.06, 0.16, 0.32);
const GRAY = rgb(0.1, 0.1, 0.1);

const FIELDS = {
  sigPage: 5,
  company: {
    signatureLine: { x: 82, y: 655 },
    date: { x: 100, y: 575 },
  },
  agent: {
    signatureLine: { x: 82, y: 515 },
    printName: { x: 155, y: 480 },
    date: { x: 100, y: 465 },
  },
  entity: {
    signatureLine: { x: 82, y: 385 },
    printName: { x: 155, y: 355 },
    date: { x: 100, y: 340 },
  },
};

async function main() {
  const pdfPath = join(process.cwd(), 'public', 'documents', 'NXT_Independent_Contractor_Agreement_Revised.pdf');
  const existingPdfBytes = await readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  const page = pdfDoc.getPage(FIELDS.sigPage);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const sigSize = 20;
  const textSize = 12;
  const signedDate = 'October 26, 2026';

  // Company signature
  page.drawText('Shiv Thakur', {
    x: FIELDS.company.signatureLine.x + 25,
    y: FIELDS.company.signatureLine.y,
    size: sigSize, font: timesItalic, color: NAVY,
  });
  page.drawText(signedDate, {
    x: FIELDS.company.date.x,
    y: FIELDS.company.date.y,
    size: textSize, font: timesRoman, color: GRAY,
  });

  // Contractor signature
  page.drawText('Jaswanth Reddy Kancham', {
    x: FIELDS.agent.signatureLine.x,
    y: FIELDS.agent.signatureLine.y,
    size: sigSize, font: timesItalic, color: NAVY,
  });
  page.drawText('Jaswanth Reddy Kancham', {
    x: FIELDS.agent.printName.x,
    y: FIELDS.agent.printName.y,
    size: textSize, font: timesRoman, color: GRAY,
  });
  page.drawText(signedDate, {
    x: FIELDS.agent.date.x,
    y: FIELDS.agent.date.y,
    size: textSize, font: timesRoman, color: GRAY,
  });

  // Entity acknowledgment
  page.drawText('Jaswanth Reddy Kancham', {
    x: FIELDS.entity.signatureLine.x,
    y: FIELDS.entity.signatureLine.y,
    size: sigSize, font: timesItalic, color: NAVY,
  });
  page.drawText('Kancham Financial LLC', {
    x: FIELDS.entity.printName.x,
    y: FIELDS.entity.printName.y,
    size: textSize, font: timesRoman, color: GRAY,
  });
  page.drawText(signedDate, {
    x: FIELDS.entity.date.x,
    y: FIELDS.entity.date.y,
    size: textSize, font: timesRoman, color: GRAY,
  });

  const pdfBytes = await pdfDoc.save();
  const outPath = join('/Users/jaswanthreddykancham/Desktop', 'SAMPLE_ICA_Filled.pdf');
  await writeFile(outPath, pdfBytes);
  console.log('Written to', outPath);
}

main().catch(console.error);
