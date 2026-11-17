import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { loadTemplateFonts, renderTemplateDocument, templateDocumentModel, templateFontCss, templatePaperCss } from "../lib/templateDocument.js";

export function TemplateSheets({ pages, sideBySide = false, zoom }) {
  const container = useRef(null);
  const [width, setWidth] = useState(350);
  useLayoutEffect(() => {
    const measure = () => { if (container.current.clientWidth > 0) setWidth(container.current.clientWidth); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const columns = sideBySide && width >= 580 ? 2 : 1;
  const scale = zoom ?? Math.min(1, (width - (columns - 1) * 16) / 794 / columns);
  return <div ref={container} className="tpl-sheets" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
    {pages.map((html, index) => <div className="tpl-sheet-wrap" key={index}
      style={{ width: 794 * scale, minHeight: 1122 * scale }}>
      <div style={{ zoom: scale }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>)}
  </div>;
}

export default function TemplatePreview({ cv, style, demo = false, sideBySide = false, zoom }) {
  const model = useMemo(() => templateDocumentModel(cv, style), [cv, style]);
  const [rendered, setRendered] = useState(null);
  useEffect(() => {
    let active = true;
    const draw = () => {
      if (active) setRendered(renderTemplateDocument(model, demo));
    };
    draw();
    loadTemplateFonts(model.design.font).then(draw);
    return () => { active = false; };
  }, [model, demo]);
  const initial = !rendered && typeof document === "undefined" ? renderTemplateDocument(model, demo) : null;
  const result = rendered || initial;
  return <div className="tpl-document-preview">
    <style>{templateFontCss(model.design.font)}{"\n"}{templatePaperCss}</style>
    {result && <TemplateSheets pages={result.html} sideBySide={sideBySide} zoom={zoom} />}
    {!demo && result?.pages.length > 2 && <p role="status" className="tpl-warning">This CV is longer than two pages.</p>}
    {(result?.oversized || result?.pages.length > model.design.template.maxPages) &&
      <p role="alert" className="tpl-warning">This layout fits up to four pages. Shorten long sections or use a standard layout before downloading.</p>}
  </div>;
}
