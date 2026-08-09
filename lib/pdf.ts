import "server-only";

import { formatMoney } from "@/lib/pricing";

export type ProposalPdfLineItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type ProposalPdfData = {
  proposalNumber?: string;
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  customerName: string;
  customerEmail?: string;
  jobTitle: string;
  jobAddress?: string;
  scopeOfWork: string;
  assumptions?: string[];
  exclusions?: string[];
  terms?: string;
  validUntil?: string;
  lineItems: ProposalPdfLineItem[];
  subtotalCents: number;
  markupCents?: number;
  taxCents?: number;
  totalCents: number;
  depositAmountCents?: number;
  currency?: string;
};

function clean(value: string | undefined, max = 1_500) {
  return (value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function money(cents: number, currency: string) {
  return formatMoney(Number.isFinite(cents) ? cents : 0, currency);
}

/** Generates a compact, server-side PDF without rendering untrusted HTML. */
export async function generateProposalPdf(data: ProposalPdfData): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 612;
  const height = 792;
  const margin = 48;
  const contentWidth = width - margin * 2;
  const currency = data.currency ?? "usd";
  let page = pdf.addPage([width, height]);
  let y = height - margin;

  const addPage = () => {
    page = pdf.addPage([width, height]);
    y = height - margin;
  };
  const ensure = (needed: number) => {
    if (y - needed < margin) addPage();
  };
  const write = (text: string, size = 10, isBold = false, color = rgb(0.12, 0.16, 0.2)) => {
    ensure(size + 7);
    page.drawText(text, { x: margin, y: y - size, size, font: isBold ? bold : regular, color });
    y -= size + 7;
  };
  const writeRight = (text: string, x: number, size = 10, isBold = false) => {
    const font = isBold ? bold : regular;
    page.drawText(text, { x: x - font.widthOfTextAtSize(text, size), y: y - size, size, font, color: rgb(0.12, 0.16, 0.2) });
  };
  const wrap = (text: string, size = 10, maxWidth = contentWidth) => {
    const words = clean(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (regular.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const paragraph = (text: string, size = 10) => {
    for (const line of wrap(text, size)) write(line, size);
  };
  const section = (label: string) => {
    y -= 6;
    write(label.toUpperCase(), 9, true, rgb(0.05, 0.45, 0.42));
  };

  write(clean(data.companyName, 120) || "ContractorCopilot", 22, true, rgb(0.05, 0.45, 0.42));
  [data.companyAddress, data.companyPhone, data.companyEmail].map((value) => clean(value, 180)).filter(Boolean).forEach((value) => write(value, 9));
  y -= 8;
  write("PROPOSAL", 18, true);
  if (data.proposalNumber) write(`Proposal #${clean(data.proposalNumber, 80)}`, 9);
  if (data.validUntil) write(`Valid through ${clean(data.validUntil, 80)}`, 9);
  y -= 6;

  section("Prepared for");
  write(clean(data.customerName, 160) || "Customer", 11, true);
  if (data.customerEmail) write(clean(data.customerEmail, 180), 9);
  write(clean(data.jobTitle, 200) || "Project", 10);
  if (data.jobAddress) write(clean(data.jobAddress, 240), 9);

  section("Scope of work");
  paragraph(data.scopeOfWork, 10);

  section("Investment");
  ensure(35);
  page.drawRectangle({ x: margin, y: y - 6, width: contentWidth, height: 20, color: rgb(0.93, 0.96, 0.95) });
  page.drawText("DESCRIPTION", { x: margin + 6, y: y, size: 8, font: bold, color: rgb(0.12, 0.16, 0.2) });
  page.drawText("QTY", { x: 350, y: y, size: 8, font: bold, color: rgb(0.12, 0.16, 0.2) });
  page.drawText("AMOUNT", { x: 480, y: y, size: 8, font: bold, color: rgb(0.12, 0.16, 0.2) });
  y -= 25;

  for (const item of data.lineItems.slice(0, 100)) {
    const descriptionLines = wrap(clean(item.description, 240), 9, 278);
    ensure(Math.max(22, descriptionLines.length * 12 + 4));
    descriptionLines.forEach((line, index) => {
      page.drawText(line, { x: margin + 4, y: y - 9 - index * 12, size: 9, font: regular, color: rgb(0.12, 0.16, 0.2) });
    });
    const qty = `${item.quantity} ${clean(item.unit, 16)}`;
    page.drawText(qty, { x: 350, y: y - 9, size: 8, font: regular, color: rgb(0.12, 0.16, 0.2) });
    writeRight(money(item.lineTotalCents, currency), width - margin, 9);
    y -= Math.max(22, descriptionLines.length * 12 + 4);
  }

  const totalLine = (label: string, amount: number, emphasis = false) => {
    ensure(19);
    page.drawText(label, { x: 370, y: y - 10, size: emphasis ? 11 : 9, font: emphasis ? bold : regular, color: rgb(0.12, 0.16, 0.2) });
    writeRight(money(amount, currency), width - margin, emphasis ? 11 : 9, emphasis);
    y -= 18;
  };
  totalLine("Subtotal", data.subtotalCents);
  if (data.markupCents) totalLine("Markup", data.markupCents);
  if (data.taxCents) totalLine("Tax", data.taxCents);
  totalLine("Total", data.totalCents, true);
  if (data.depositAmountCents && data.depositAmountCents > 0) totalLine("Deposit due to schedule", data.depositAmountCents, true);

  const bullets = (title: string, entries: string[] | undefined) => {
    const cleaned = (entries ?? []).map((entry) => clean(entry, 600)).filter(Boolean);
    if (!cleaned.length) return;
    section(title);
    cleaned.forEach((entry) => wrap(`• ${entry}`, 9).forEach((line) => write(line, 9)));
  };
  bullets("Assumptions", data.assumptions);
  bullets("Exclusions", data.exclusions);
  if (data.terms) {
    section("Terms");
    paragraph(data.terms, 9);
  }

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    current.drawText(`Generated by ContractorCopilot  •  Page ${index + 1} of ${pages.length}`, {
      x: margin,
      y: 24,
      size: 8,
      font: regular,
      color: rgb(0.4, 0.45, 0.48),
    });
  });

  return pdf.save();
}

export function proposalPdfFileName(title: string) {
  const slug = clean(title, 80).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "proposal";
  return `${slug}-proposal.pdf`;
}
