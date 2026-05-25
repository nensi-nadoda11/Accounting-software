import { createHash } from "crypto";
import { deflateRawSync } from "zlib";

import type { ReportColumn, ReportExportDataset, ReportExportFormat, ReportFilePayload } from "./reports.types";

const csvEscape = (value: string) => `"${value.replaceAll('"', '""')}"`;
const PDF_ACCENT = { r: 0.03, g: 0.62, b: 0.55 };
const PDF_BORDER = { r: 0.85, g: 0.89, b: 0.94 };
const PDF_TEXT = { r: 0.11, g: 0.17, b: 0.28 };
const PDF_MUTED = { r: 0.43, g: 0.49, b: 0.58 };
const PDF_HEADER_FILL = { r: 0.94, g: 0.97, b: 0.99 };
const PDF_SUMMARY_FILL = { r: 0.96, g: 0.99, b: 0.98 };

const isPhoneColumn = (key?: string) => Boolean(key && /(mobile|phone|contact)/i.test(key));
const isAmountColumn = (key?: string) =>
  Boolean(key && /(amount|total|value|balance|paid|due|taxable|gst|sales|purchase|income|expense|debit|credit|net|gross|price)/i.test(key));
const isCountColumn = (key?: string) => Boolean(key && /(count|qty|quantity|items?)/i.test(key));

const toDisplayValue = (value: string | number | Date | null | undefined, column?: ReportColumn) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (isPhoneColumn(column?.key)) {
    const digits = String(value).replace(/\D/g, "");
    if (!digits) {
      return "";
    }

    return digits.length > 10 ? digits.slice(-10) : digits;
  }

  if (column?.type === "number") {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      return String(value);
    }

    if (isAmountColumn(column.key) || isCountColumn(column.key)) {
      return String(Math.round(parsed));
    }

    return Number.isInteger(parsed) ? String(parsed) : String(parsed);
  }

  if (column?.type === "date" || column?.type === "datetime") {
    const date = value instanceof Date ? value : new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("en-IN", column.type === "date"
        ? {
            day: "2-digit",
            month: "short",
            year: "numeric"
          }
        : {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });
    }
  }

  const normalized = String(value);
  if (column?.key && /(status|mode|type|section)$/i.test(column.key)) {
    return normalized
      .replaceAll(/[_-]+/g, " ")
      .replaceAll(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  return normalized;
};

const buildCsvContent = (dataset: ReportExportDataset) => {
  const headerRow = dataset.columns.map((column) => csvEscape(column.label)).join(",");
  const bodyRows = dataset.rows.map((row) =>
    dataset.columns.map((column) => csvEscape(toDisplayValue(row[column.key], column))).join(",")
  );

  return Buffer.from(`\uFEFF${[headerRow, ...bodyRows].join("\n")}`, "utf-8");
};

const xmlEscape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const buildSheetRows = (dataset: ReportExportDataset) => {
  const rows = [
    dataset.columns.map((column) => ({ value: column.label, isNumber: false })),
    ...dataset.rows.map((row) =>
      dataset.columns.map((column) => {
        const value = row[column.key];
        const isNumber = column.type === "number" && value !== null && value !== undefined && value !== "";
        return {
          value: toDisplayValue(value, column),
          isNumber
        };
      })
    )
  ];

  return rows
    .map(
      (cells, rowIndex) => `<row r="${rowIndex + 1}">${cells
        .map((cell, cellIndex) => {
          const ref = `${String.fromCharCode(65 + cellIndex)}${rowIndex + 1}`;
          if (cell.isNumber && cell.value !== "") {
            return `<c r="${ref}"><v>${xmlEscape(cell.value)}</v></c>`;
          }

          return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell.value)}</t></is></c>`;
        })
        .join("")}</row>`
    )
    .join("");
};

const buildZipDate = (date: Date) => {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
};

const crcTable = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
})();

const crc32 = (buffer: Buffer) => {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const createZip = (entries: Array<{ name: string; content: Buffer }>) => {
  const fileParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const now = buildZipDate(new Date());

  for (const entry of entries) {
    const fileName = Buffer.from(entry.name, "utf-8");
    const compressed = deflateRawSync(entry.content);
    const checksum = crc32(entry.content);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(now.dosTime, 10);
    localHeader.writeUInt16LE(now.dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(entry.content.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);

    fileParts.push(localHeader, fileName, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(now.dosTime, 12);
    centralHeader.writeUInt16LE(now.dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(entry.content.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, fileName);
    offset += localHeader.length + fileName.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...fileParts, centralDirectory, endOfCentralDirectory]);
};

const buildXlsxContent = (dataset: ReportExportDataset) => {
  const createdAt = new Date().toISOString();
  const sheetRows = buildSheetRows(dataset);
  const workbookHash = createHash("md5").update(dataset.title).digest("hex");

  const entries = [
    {
      name: "[Content_Types].xml",
      content: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
        "utf-8"
      )
    },
    {
      name: "_rels/.rels",
      content: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
        "utf-8"
      )
    },
    {
      name: "docProps/app.xml",
      content: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>LedgerFlow</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr">
      <vt:lpstr>${xmlEscape(dataset.title)}</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
</Properties>`,
        "utf-8"
      )
    },
    {
      name: "docProps/core.xml",
      content: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xmlEscape(dataset.title)}</dc:title>
  <dc:creator>LedgerFlow</dc:creator>
  <cp:lastModifiedBy>LedgerFlow</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified>
  <cp:revision>${workbookHash.slice(0, 8)}</cp:revision>
</cp:coreProperties>`,
        "utf-8"
      )
    },
    {
      name: "xl/workbook.xml",
      content: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${xmlEscape(dataset.title.slice(0, 31) || "Report")}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
        "utf-8"
      )
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
        "utf-8"
      )
    },
    {
      name: "xl/styles.xml",
      content: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`,
        "utf-8"
      )
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`,
        "utf-8"
      )
    }
  ];

  return createZip(entries);
};

const pdfEscape = (value: string) => value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");

const color = (rgb: { r: number; g: number; b: number }, type: "fill" | "stroke" = "fill") =>
  `${rgb.r.toFixed(3)} ${rgb.g.toFixed(3)} ${rgb.b.toFixed(3)} ${type === "fill" ? "rg" : "RG"}`;

const wrapText = (value: string, maxChars: number) => {
  if (!value) {
    return [""];
  }

  if (value.length <= maxChars) {
    return [value];
  }

  const words = value.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [value.slice(0, maxChars)];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    if (word.length <= maxChars) {
      current = word;
      continue;
    }

    for (let index = 0; index < word.length; index += maxChars) {
      lines.push(word.slice(index, index + maxChars));
    }
    current = "";
  }

  if (current) {
    lines.push(current);
  }

  return lines;
};

const buildPdfContent = (dataset: ReportExportDataset) => {
  const isLandscape = dataset.columns.length >= 8;
  const pageWidth = isLandscape ? 842 : 595;
  const pageHeight = isLandscape ? 595 : 842;
  const marginX = 28;
  const marginTop = 28;
  const marginBottom = 28;
  const tableFontSize = dataset.columns.length >= 10 ? 7.5 : 8.5;
  const headerFontSize = 16;
  const lineHeight = tableFontSize + 5;
  const cellPaddingX = 6;
  const cellPaddingY = 5;
  const footerHeight = 20;
  const contentWidth = pageWidth - marginX * 2;

  const metadata = dataset.metadata ?? [];
  const summary = dataset.summary ?? [];
  const rows = dataset.rows.map((row, index) => ({
    srNo: index + 1,
    values: dataset.columns.map((column) => toDisplayValue(row[column.key], column))
  }));

  const tableColumns = [
    { key: "__sr", label: "No.", type: "number" as const, values: rows.map((row) => String(row.srNo)) },
    ...dataset.columns.map((column, columnIndex) => ({
      key: column.key,
      label: column.label,
      type: column.type ?? "string",
      values: rows.map((row) => row.values[columnIndex] ?? "")
    }))
  ];

  const weights = tableColumns.map((column) => {
    if (column.key === "__sr") {
      return 0.7;
    }

    if (column.type === "number") {
      return 1;
    }

    const longest = Math.max(column.label.length, ...column.values.map((value) => String(value).length));
    return Math.min(Math.max(longest / 10, 1.2), 2.4);
  });
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const columnWidths = weights.map((weight) => (contentWidth * weight) / totalWeight);

  const headerHeight = 24;
  const tableHeaderLines = tableColumns.map((column, index) => {
    const maxChars = Math.max(4, Math.floor((columnWidths[index]! - cellPaddingX * 2) / (tableFontSize * 0.52)));
    return wrapText(column.label, maxChars);
  });
  const tableHeaderRowHeight = Math.max(...tableHeaderLines.map((lines) => lines.length)) * lineHeight + cellPaddingY * 2;

  const bodyRows = rows.map((row) => {
    const cellLines = [String(row.srNo), ...row.values].map((value, index) => {
      const maxChars = Math.max(4, Math.floor((columnWidths[index]! - cellPaddingX * 2) / (tableFontSize * 0.52)));
      return wrapText(String(value), maxChars);
    });
    const height = Math.max(...cellLines.map((lines) => lines.length)) * lineHeight + cellPaddingY * 2;
    return { cellLines, height };
  });

  const drawText = (x: number, y: number, text: string, options?: { size?: number; font?: "F1" | "F2"; color?: typeof PDF_TEXT }) => [
    "BT",
    `${options?.font ?? "F1"} ${options?.size ?? tableFontSize} Tf`,
    color(options?.color ?? PDF_TEXT),
    `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(text)}) Tj`,
    "ET"
  ].join("\n");

  const drawRect = (x: number, y: number, width: number, height: number, fillColor?: typeof PDF_TEXT, strokeColor?: typeof PDF_TEXT) => {
    const commands: string[] = [];
    if (fillColor) {
      commands.push(color(fillColor));
    }
    if (strokeColor) {
      commands.push(color(strokeColor, "stroke"));
    }
    commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${fillColor && strokeColor ? "B" : fillColor ? "f" : "S"}`);
    return commands.join("\n");
  };

  const renderPageBase = (pageNumber: number, totalPages: number) => {
    const commands: string[] = [];
    let cursorY = pageHeight - marginTop;

    commands.push(drawRect(marginX, cursorY - 4, contentWidth, 3, PDF_ACCENT));
    commands.push(drawText(marginX, cursorY - 28, dataset.title, { size: headerFontSize, font: "F2" }));
    cursorY -= 48;

    if (dataset.subtitle) {
      commands.push(drawText(marginX, cursorY, dataset.subtitle, { size: 10, color: PDF_MUTED }));
      cursorY -= 18;
    }

    if (metadata.length) {
      const itemWidth = (contentWidth - 12) / 2;
      const metaHeight = Math.ceil(metadata.length / 2) * 20 + 12;
      commands.push(drawRect(marginX, cursorY - metaHeight, contentWidth, metaHeight, PDF_HEADER_FILL, PDF_BORDER));
      metadata.forEach((item, index) => {
        const x = marginX + 10 + (index % 2) * itemWidth;
        const y = cursorY - 18 - Math.floor(index / 2) * 20;
        commands.push(drawText(x, y, `${item.label}:`, { size: 8.5, font: "F2", color: PDF_MUTED }));
        commands.push(drawText(x + 66, y, item.value, { size: 8.5 }));
      });
      cursorY -= metaHeight + 12;
    }

    if (summary.length) {
      const cardsPerRow = Math.max(2, Math.min(4, Math.floor(contentWidth / 170)));
      const cardGap = 10;
      const cardWidth = (contentWidth - cardGap * (cardsPerRow - 1)) / cardsPerRow;
      const summaryRows = Math.ceil(summary.length / cardsPerRow);
      const cardHeight = 42;

      for (let index = 0; index < summary.length; index += 1) {
        const cardX = marginX + (index % cardsPerRow) * (cardWidth + cardGap);
        const cardY = cursorY - Math.floor(index / cardsPerRow) * (cardHeight + 10) - cardHeight;
        commands.push(drawRect(cardX, cardY, cardWidth, cardHeight, PDF_SUMMARY_FILL, PDF_BORDER));
        commands.push(drawText(cardX + 10, cardY + 26, summary[index]!.label, { size: 8, color: PDF_MUTED }));
        commands.push(drawText(cardX + 10, cardY + 10, String(summary[index]!.value), { size: 11, font: "F2" }));
      }

      cursorY -= summaryRows * (cardHeight + 10) + 6;
    }

    const footerY = marginBottom - 6;
    commands.push(drawText(marginX, footerY, "Generated by LedgerFlow", { size: 8, color: PDF_MUTED }));
    commands.push(drawText(pageWidth - marginX - 64, footerY, `Page ${pageNumber} / ${totalPages}`, { size: 8, color: PDF_MUTED }));

    return { commands, cursorY };
  };

  const pageRows: Array<typeof bodyRows> = [];
  let currentPageRows: typeof bodyRows = [];
  let availableHeight = 0;

  const measurePageCapacity = () => {
    const base = renderPageBase(1, 1);
    return base.cursorY - marginBottom - footerHeight - tableHeaderRowHeight - 10;
  };
  availableHeight = measurePageCapacity();

  let usedHeight = 0;
  for (const row of bodyRows) {
    if (currentPageRows.length && usedHeight + row.height > availableHeight) {
      pageRows.push(currentPageRows);
      currentPageRows = [];
      usedHeight = 0;
    }
    currentPageRows.push(row);
    usedHeight += row.height;
  }

  if (!pageRows.length || currentPageRows.length) {
    pageRows.push(currentPageRows);
  }

  const pageStreams = pageRows.map((rowsForPage, pageIndex) => {
    const { commands, cursorY: pageStartY } = renderPageBase(pageIndex + 1, pageRows.length);
    let tableY = pageStartY - headerHeight;

    commands.push(drawRect(marginX, tableY - tableHeaderRowHeight, contentWidth, tableHeaderRowHeight, PDF_ACCENT, PDF_ACCENT));

    let columnX = marginX;
    tableHeaderLines.forEach((lines, columnIndex) => {
      lines.forEach((line, lineIndex) => {
        commands.push(
          drawText(columnX + cellPaddingX, tableY - cellPaddingY - lineHeight * (lineIndex + 1) + 4, line, {
            size: tableFontSize,
            font: "F2",
            color: { r: 1, g: 1, b: 1 }
          })
        );
      });
      columnX += columnWidths[columnIndex]!;
    });

    tableY -= tableHeaderRowHeight;

    rowsForPage.forEach((row, rowIndex) => {
      const fill = rowIndex % 2 === 0 ? { r: 1, g: 1, b: 1 } : { r: 0.985, g: 0.99, b: 0.995 };
      commands.push(drawRect(marginX, tableY - row.height, contentWidth, row.height, fill, PDF_BORDER));

      let x = marginX;
      row.cellLines.forEach((cell, columnIndex) => {
        const isNumber = tableColumns[columnIndex]!.type === "number";
        const textX = isNumber ? x + columnWidths[columnIndex]! - cellPaddingX : x + cellPaddingX;
        cell.forEach((line, lineIndex) => {
          const renderedWidth = line.length * tableFontSize * 0.47;
          const lineX = isNumber ? textX - renderedWidth : textX;
          commands.push(drawText(lineX, tableY - cellPaddingY - lineHeight * (lineIndex + 1) + 4, line, { size: tableFontSize }));
        });
        x += columnWidths[columnIndex]!;
      });

      tableY -= row.height;
    });

    return commands.join("\n");
  });

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageRefs = pageStreams.map((_, index) => `${5 + index * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Count ${pageStreams.length} /Kids [${pageRefs}] >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pageStreams.forEach((stream) => {
    const contentObjectId = objects.length + 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    objects.push(`<< /Length ${Buffer.byteLength(stream, "utf-8")} >>\nstream\n${stream}\nendstream`);
  });

  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "utf-8"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body, "utf-8");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, "utf-8");
};

export const buildReportFile = (
  dataset: ReportExportDataset,
  format: ReportExportFormat,
  fileBaseName: string
): ReportFilePayload => {
  if (format === "csv") {
    return {
      fileName: `${fileBaseName}.csv`,
      contentType: "text/csv; charset=utf-8",
      content: buildCsvContent(dataset)
    };
  }

  if (format === "xlsx") {
    return {
      fileName: `${fileBaseName}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      content: buildXlsxContent(dataset)
    };
  }

  return {
    fileName: `${fileBaseName}.pdf`,
    contentType: "application/pdf",
    content: buildPdfContent(dataset)
  };
};
