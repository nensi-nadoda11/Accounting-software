import { createHash } from "crypto";
import { deflateRawSync } from "zlib";

import type { ReportColumn, ReportExportDataset, ReportExportFormat, ReportFilePayload } from "./reports.types";

const csvEscape = (value: string) => `"${value.replaceAll('"', '""')}"`;

const toDisplayValue = (value: string | number | null | undefined, column?: ReportColumn) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (column?.type === "number") {
    return typeof value === "number" ? value.toFixed(2) : String(value);
  }

  return String(value);
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

const buildPdfContent = (dataset: ReportExportDataset) => {
  const maxColumnWidth = Math.max(12, Math.floor(140 / Math.max(dataset.columns.length, 1)));
  const lines = [
    dataset.title,
    "",
    dataset.columns.map((column) => column.label.padEnd(maxColumnWidth).slice(0, maxColumnWidth)).join(" "),
    dataset.columns.map(() => "-".repeat(maxColumnWidth)).join(" ")
  ];

  for (const row of dataset.rows) {
    lines.push(
      dataset.columns
        .map((column) => toDisplayValue(row[column.key], column).padEnd(maxColumnWidth).slice(0, maxColumnWidth))
        .join(" ")
    );
  }

  const pageHeight = 792;
  const pageWidth = 612;
  const fontSize = 9;
  const lineHeight = 14;
  const linesPerPage = 48;
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / linesPerPage)) }, (_, index) =>
    lines.slice(index * linesPerPage, (index + 1) * linesPerPage)
  );

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageObjectIds: number[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    pageObjectIds.push(0);
  }

  const pagesKids = pageObjectIds.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Count ${pages.length} /Kids [${pagesKids}] >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  for (const pageLines of pages) {
    const pageObjectId = objects.length + 1;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);

    const contentLines = [
      "BT",
      `/F1 ${fontSize} Tf`
    ];
    let y = pageHeight - 48;

    for (const line of pageLines) {
      contentLines.push(`1 0 0 1 36 ${y} Tm (${pdfEscape(line)}) Tj`);
      y -= lineHeight;
    }

    contentLines.push("ET");
    const stream = contentLines.join("\n");

    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`);
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
