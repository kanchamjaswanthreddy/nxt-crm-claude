import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'fs/promises';
import { join } from 'path';

const NAVY = rgb(0.06, 0.16, 0.32); // brand-navy
const GRAY = rgb(0.1, 0.1, 0.1);

/**
 * Signature field coordinates for each document.
 * Y is from the bottom of the page (PDF coordinate system).
 * All pages are 612x792 (US Letter).
 */
const FIELD_MAP = {
  ica: {
    sigPage: 5, // page 6 (0-indexed)
    company: {
      signatureLine: { x: 82, y: 655, label: 'By' },
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
  },
  aoa: {
    sigPage: 17, // page 18 (0-indexed)
    company: {
      signatureLine: { x: 82, y: 285, label: 'By' },
      date: { x: 100, y: 205 },
    },
    agent: {
      signatureLine: { x: 82, y: 150 },
      printName: { x: 135, y: 115 },
      assignedLevel: { x: 250, y: 97.5 },
      date: { x: 100, y: 80 },
    },
  },
  businessStandards: {
    sigPage: 2, // page 3 (0-indexed)
    agent: {
      signatureLine: { x: 82, y: 152 },
      printName: { x: 155, y: 115 },
      date: { x: 100, y: 90 },
    },
  },
};

const PDF_FILES = {
  ica: 'NXT_Independent_Contractor_Agreement_Revised.pdf',
  aoa: 'NXT_Agent_Ownership_Agreement_Revised.pdf',
  businessStandards: 'NXT_Business_Standards_Revised.pdf',
};

/**
 * Fill a PDF with signature data and return the modified PDF bytes.
 * @param {'ica'|'aoa'|'businessStandards'} docType
 * @param {object} sigData - signature data from Firestore agreement object
 * @param {string} signedDate - formatted date string
 */
export async function fillSignedPdf(docType, sigData, signedDate) {
  const pdfPath = join(process.cwd(), 'public', 'documents', PDF_FILES[docType]);
  const existingPdfBytes = await readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  const fields = FIELD_MAP[docType];
  const page = pdfDoc.getPage(fields.sigPage);

  // Embed fonts
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const sigFont = timesItalic;
  const textFont = timesRoman;
  const sigSize = 20;
  const textSize = 12;

  // --- Company signature (ICA and AOA only) ---
  if (fields.company) {
    const companyName = sigData.company_signee || 'Shiv Thakur';
    const { signatureLine, date } = fields.company;

    // Signature on the "By:" line
    page.drawText(companyName, {
      x: signatureLine.x + 25,
      y: signatureLine.y,
      size: sigSize,
      font: sigFont,
      color: NAVY,
    });

    // Date
    page.drawText(signedDate, {
      x: date.x,
      y: date.y,
      size: textSize,
      font: textFont,
      color: GRAY,
    });
  }

  // --- Agent / Contractor / Associate signature ---
  if (fields.agent && sigData.signatureName) {
    const { signatureLine, printName, date, assignedLevel } = fields.agent;

    // Signature (italic, larger)
    page.drawText(sigData.signatureName, {
      x: signatureLine.x,
      y: signatureLine.y,
      size: sigSize,
      font: sigFont,
      color: NAVY,
    });

    // Print name
    if (printName && sigData.printName) {
      page.drawText(sigData.printName, {
        x: printName.x,
        y: printName.y,
        size: textSize,
        font: textFont,
        color: GRAY,
      });
    }

    // Assigned level (AOA only)
    if (assignedLevel && sigData.assignedLevel) {
      page.drawText(`Level ${sigData.assignedLevel}`, {
        x: assignedLevel.x,
        y: assignedLevel.y,
        size: textSize,
        font: textFont,
        color: GRAY,
      });
    }

    // Date
    if (date) {
      page.drawText(signedDate, {
        x: date.x,
        y: date.y,
        size: textSize,
        font: textFont,
        color: GRAY,
      });
    }
  }

  // --- Entity / Individual Producer acknowledgment (ICA only) ---
  // Always fill the Individual Producer Signature section with the agent's
  // signature. If an entityName is provided, use it for Print Name; otherwise
  // fall back to the agent's printName.
  if (fields.entity && sigData.signatureName) {
    const { signatureLine, printName, date } = fields.entity;

    page.drawText(sigData.signatureName, {
      x: signatureLine.x,
      y: signatureLine.y,
      size: sigSize,
      font: sigFont,
      color: NAVY,
    });

    if (printName) {
      const entityPrintName = sigData.entityName || sigData.printName;
      if (entityPrintName) {
        page.drawText(entityPrintName, {
          x: printName.x,
          y: printName.y,
          size: textSize,
          font: textFont,
          color: GRAY,
        });
      }
    }

    if (date) {
      page.drawText(signedDate, {
        x: date.x,
        y: date.y,
        size: textSize,
        font: textFont,
        color: GRAY,
      });
    }
  }

  return pdfDoc.save();
}
