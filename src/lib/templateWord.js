import { isSamplePreview, loadTemplateFonts, renderTemplateDocument, templateDocumentModel } from "./templateDocument.js";

export async function buildTemplateWord(cv, photo) {
  const { AlignmentType, BorderStyle, Document, Footer, ImageRun, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } = await import("docx");
  const model = templateDocumentModel(cv, cv.templateStyle);
  const { rtl, design, name, job } = model;
  await loadTemplateFonts(design.font);
  const result = renderTemplateDocument(model, isSamplePreview(cv));
  if (result.oversized || result.pages.length > design.template.maxPages) throw new Error("Shorten the CV to four pages or choose a standard layout before downloading.");
  const hex = (value) => value.replace("#", "");
  const paragraph = (text, options = {}) => new Paragraph({
    alignment: options.center ? AlignmentType.CENTER : rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
    bidirectional: rtl, spacing: { after: options.after ?? 60 }, keepNext: options.keepNext,
    keepLines: true, bullet: options.bullet ? { level: 0 } : undefined,
    children: [new TextRun({ text, font: design.font.word, rightToLeft: rtl, bold: options.bold, size: options.size ?? 19, color: hex(options.color || "#1F2937") })],
  });
  const title = (text, color = design.ink) => paragraph(text.toUpperCase(), { bold: true, size: 19, color, keepNext: true, after: 100 });
  const shading = (fill) => ({ type: ShadingType.CLEAR, fill: hex(fill) });
  const cell = (children, fill, size) => new TableCell({ children: children.length ? children : [paragraph("")],
    width: { size, type: WidthType.PERCENTAGE }, shading: fill ? shading(fill) : undefined,
    margins: { top: 90, bottom: 90, left: 160, right: 160 } });
  const table = (cells) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: rtl,
    borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map((side) => [side, { style: BorderStyle.NONE }])),
    rows: [new TableRow({ children: cells })] });
  const entries = (blocks, color) => blocks.flatMap((block, i) => {
    const heading = i && blocks[i - 1].id === block.id ? [] : [title(block.heading, color || design.ink)];
    if (!block.bullets) return [...heading, ...block.paragraphs.map((p) => paragraph(p, { color }))];
    const entry = [
      paragraph(block.title, { color, bold: true, keepNext: Boolean(block.meta || block.bullets.length) }),
      ...(block.meta ? [paragraph(block.meta, { color, keepNext: Boolean(block.bullets.length) })] : []),
      ...block.bullets.map((line, index) => paragraph(line, { bullet: true, color, keepNext: index < block.bullets.length - 1 })),
    ];
    if (design.template.layout === "timeline") return [...heading, table([cell([paragraph(block.dates, { color: design.ink, bold: true })], null, 18), cell(entry, null, 82)])];
    return [...heading, ...(block.dates ? [paragraph(block.dates, { color, keepNext: true })] : []), ...entry];
  });
  const portrait = design.showPhoto ? photo
    ? new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: photo.data, type: photo.type, transformation: {
      width: 86, height: cv.photoFrameFormat === "passport-35x45" ? 111 : 86,
    } })] }) : paragraph(model.initials, { center: true, bold: true, size: 28,
      color: design.template.layout === "sidebar" ? design.onAccent : design.ink }) : null;
  const pages = result.pages;
  const doc = new Document({ sections: pages.map((page, i) => {
    const sidebar = design.template.layout === "sidebar";
    const executive = design.template.layout === "header_band_two_col";
    const center = design.template.layout === "single_column";
    const nameStrip = [
      ...(!i && !sidebar && portrait ? [portrait] : []),
      paragraph(name, { size: i ? 25 : 38, bold: true, color: executive ? design.onAccent : design.ink, center, keepNext: true }),
      paragraph(job, { size: 23, bold: true, color: executive ? design.onAccent : design.ink, center }),
      ...(!i && !sidebar ? [paragraph(model.contacts.join(" · "), { center, after: 140, color: executive ? design.onAccent : undefined })] : []),
    ];
    const main = entries(page.main);
    const sideColor = sidebar ? design.onAccent : undefined;
    const side = [
      ...(!i && sidebar && portrait ? [portrait] : []),
      ...(!i && sidebar ? model.contacts.map((item) => paragraph(item, { color: sideColor })) : []),
      ...entries(page.side, sideColor),
    ];
    return {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 760, right: 840, bottom: 720, left: 840 } } },
      footers: { default: new Footer({ children: [paragraph(`${name} — CV     |     Page ${i + 1} of ${pages.length}`, { size: 16 })] }) },
      children: sidebar ? [table([cell(side, design.accent, 34), cell([...nameStrip, ...main], null, 66)])]
        : executive ? [table([cell(nameStrip, design.accent, 100)]), table([cell(main, null, 66), cell(side, "#F1F5F9", 34)])]
          : [...nameStrip, ...main],
    };
  }) });
  return { blob: await Packer.toBlob(doc), pageCount: pages.length };
}
