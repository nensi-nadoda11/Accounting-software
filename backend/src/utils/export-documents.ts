import type { ReportFilePayload } from "../modules/reports/reports.types";

const PAGE_HEIGHT = 792;
const PAGE_WIDTH = 612;
const FONT_SIZE = 9;
const LINE_HEIGHT = 14;
const PAGE_MARGIN_X = 36;
const PAGE_MARGIN_TOP = 48;
const LINES_PER_PAGE = 48;

const pdfEscape = (value: string) =>
  value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");

const wrapLine = (value: string, maxWidth = 92) => {
  if (value.length <= maxWidth) {
    return [value];
  }

  const words = value.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [value.slice(0, maxWidth)];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    if (word.length <= maxWidth) {
      current = word;
      continue;
    }

    for (let index = 0; index < word.length; index += maxWidth) {
      lines.push(word.slice(index, index + maxWidth));
    }
    current = "";
  }

  if (current) {
    lines.push(current);
  }

  return lines;
};

export const buildTextPdfFile = (fileBaseName: string, lines: string[]): ReportFilePayload => {
  const normalizedLines = lines.flatMap((line) => wrapLine(line));
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(normalizedLines.length / LINES_PER_PAGE)) },
    (_, index) => normalizedLines.slice(index * LINES_PER_PAGE, (index + 1) * LINES_PER_PAGE)
  );

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesKids = pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Count ${pages.length} /Kids [${pagesKids}] >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

  for (const pageLines of pages) {
    const pageObjectId = objects.length + 1;
    const contentObjectId = pageObjectId + 1;
    const contentLines = ["BT", `/F1 ${FONT_SIZE} Tf`];
    let y = PAGE_HEIGHT - PAGE_MARGIN_TOP;

    for (const line of pageLines) {
      contentLines.push(`1 0 0 1 ${PAGE_MARGIN_X} ${y} Tm (${pdfEscape(line)}) Tj`);
      y -= LINE_HEIGHT;
    }

    contentLines.push("ET");
    const stream = contentLines.join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    objects.push(`<< /Length ${Buffer.byteLength(stream, "utf-8")} >>\nstream\n${stream}\nendstream`);
  }

  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body, "utf-8"));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(body, "utf-8");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return {
    fileName: `${fileBaseName}.pdf`,
    contentType: "application/pdf",
    content: Buffer.from(body, "utf-8")
  };
};

export const buildWhatsappShareUrl = (mobile: string, message: string) => {
  const digits = mobile.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};
