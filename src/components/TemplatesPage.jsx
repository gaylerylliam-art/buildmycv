import React, { useEffect, useMemo, useState } from "react";
import SiteHeader from "./SiteHeader.jsx";
import { categories } from "../data/categories.js";
import { cvTemplates, getTemplateDesign, normalizeTemplateColor, resolveTemplateStyle, templateColors, templateFonts } from "../data/cvTemplates.js";
import { getTemplateSample } from "../data/cvTemplateSamples.js";
import { storeTemplateDraft } from "../lib/templateDrafts.js";
import { templateFontCss, templateFontStack } from "../lib/templateDocument.js";
import { listUserCvs, supabase } from "../supabaseClient.js";
import { trackEvent } from "../utils/analytics.js";
import TemplatePreview from "./TemplatePreview.jsx";
import "./templatesPage.css";

export function TemplateStyleControls({ style, onChange, chooseTemplate = false }) {
  const design = getTemplateDesign(style);
  const [hex, setHex] = useState(style.accentColor);
  useEffect(() => { setHex(style.accentColor); }, [style.accentColor]);
  const setColor = (input) => {
    setHex(input);
    const accentColor = normalizeTemplateColor(input);
    if (accentColor && accentColor !== style.accentColor) {
      onChange({ ...style, accentColor });
      trackEvent("template_color_changed", { templateId: style.templateId, accentColor, isPreset: templateColors.some(({ value }) => value === accentColor) });
    }
  };
  return <div className="tpl-controls">
    {chooseTemplate && <label className="tpl-field">CV template
      <select value={style.templateId} onChange={(event) => onChange(resolveTemplateStyle({ templateId: event.target.value, accentColor: style.accentColor, fontId: style.fontId }))}>
        {cvTemplates.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>}
    <fieldset><legend>Colour</legend>
      <div className="tpl-colours">{templateColors.map(({ name, value }) => <button
        type="button" key={value} style={{ backgroundColor: value }} title={name} aria-label={name}
        aria-pressed={style.accentColor === value} onClick={() => setColor(value)} />)}</div>
      <div className="tpl-custom">
        <input type="color" aria-label="Pick custom colour" value={style.accentColor.toLowerCase()} onChange={(event) => setColor(event.target.value)} />
        <label className="tpl-field">Custom colour
          <input type="text" value={hex} maxLength={7} spellCheck={false} aria-invalid={!normalizeTemplateColor(hex)} onChange={(event) => {
            const value = event.target.value;
            if (value.length === 7) setColor(value); else setHex(value);
          }} onBlur={() => { if (normalizeTemplateColor(hex)) setColor(hex); }} />
        </label>
      </div>
      {!normalizeTemplateColor(hex) && <p className="tpl-warning" role="status">Enter a colour like #0F766E or #ABC.</p>}
      {design.warning && <p className="tpl-warning" role="status">Very light colour: headings and text use darker, readable shades.</p>}
    </fieldset>
    <fieldset><legend>Font</legend>
      <style>{templateFonts.map(templateFontCss).join("\n")}</style>
      <div className="tpl-fonts">{templateFonts.map((font) => <button type="button" key={font.id}
        aria-pressed={style.fontId === font.id} onClick={() => {
          onChange({ ...style, fontId: font.id });
          trackEvent("template_font_changed", { templateId: style.templateId, fontId: font.id });
        }}><span aria-hidden="true" style={{ fontFamily: templateFontStack(font) }}>Aa</span>{font.name}</button>)}</div>
    </fieldset>
    {design.template.photo && <label className="tpl-check"><input type="checkbox" checked={style.showPhoto}
      onChange={(event) => onChange({ ...style, showPhoto: event.target.checked })} /> Show profile photo or initials on page 1</label>}
  </div>;
}

export default function TemplatesPage() {
  const [style, setStyle] = useState(() => resolveTemplateStyle({ templateId: "classic" }));
  const [category, setCategory] = useState("");
  const [saved, setSaved] = useState([]);
  const [ownerId, setOwnerId] = useState(null);
  const [source, setSource] = useState("sample");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = cvTemplates.find((item) => item.id === style.templateId);
  const options = cvTemplates.filter((item) => item.active && (!category || item.categories.includes(category)));
  const cv = useMemo(() => ({ ...getTemplateSample(active.id), showCredit: false }), [active.id]);
  const choose = (item) => { setStyle(resolveTemplateStyle({ templateId: item.id })); setError(""); };

  useEffect(() => { trackEvent("template_viewed", { templateId: style.templateId }); }, [style.templateId]);
  useEffect(() => {
    let canceled = false;
    supabase?.auth.getSession().then(async ({ data }) => {
      const id = data.session?.user?.id;
      if (!id || canceled) return;
      setOwnerId(id);
      const records = await listUserCvs(id, { cleanupExpired: false });
      if (!canceled) setSaved(records);
    }).catch(() => {});
    return () => { canceled = true; };
  }, []);

  const start = async (content = source) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const selected = saved.find((item) => item.id === content);
      const contentSource = ["sample", "blank"].includes(content) ? content : "existing_cv";
      if (contentSource === "existing_cv" && !selected) throw new Error("This CV is no longer available.");
      const response = await fetch("/api/cvs/from-template", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...style, contentSource }) });
      if (response.status === 429) throw new Error("Too many template requests. Please try again later.");
      if (!response.ok) throw new Error("Could not open this template. Please try again.");
      const { draft } = await response.json();
      const payload = contentSource === "sample" ? { ...getTemplateSample(active.id), sampleTemplateId: active.id } :
        contentSource === "blank" ? { fullName: "", jobTitle: "", email: "", phone: "", country: "", summary: "", experience: "",
          workExperiences: [], education: "", skills: "", languages: "", certifications: "", references: { mode: "none", entries: [] } } :
          { ...selected.cv_data, templateStyle: draft.style };
      const url = storeTemplateDraft(draft, payload, selected?.category_id || selected?.categoryId || active.categories[0],
        contentSource === "existing_cv" ? ownerId : null);
      trackEvent("template_used", { templateId: style.templateId, accentColor: style.accentColor, fontId: style.fontId, contentSource });
      window.location.assign(url);
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return <div className="tpl-page">
    <SiteHeader path="/templates" />
    <main>
      <section className="tpl-catalog"><div className="tpl-wrap">
        <p className="tpl-eyebrow">Ready-made CV templates</p>
        <h1>CV templates</h1>
        <p className="tpl-lede">Choose a two-page example, make it yours with colour and type, and edit it in the CV builder.</p>
        <div className="tpl-catalog-head"><h2>1. Choose a template</h2>
          <label className="tpl-filter"><span>Industry</span><select value={category} onChange={(event) => {
            const id = event.target.value;
            setCategory(id);
            if (id && !active.categories.includes(id)) choose(cvTemplates.find((item) => item.active && item.categories.includes(id)));
          }}><option value="">All industries</option>{categories.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
        </div>
        <div className="tpl-grid">{options.map((item) => <button className="tpl-option" type="button" key={item.id} aria-pressed={active.id === item.id} onClick={() => choose(item)}>
          <span className="tpl-thumbnail"><img src={`/assets/cv-templates/${item.id}-p1.webp`} alt="" width="397" height="561" decoding="async" /></span>
          <strong>{item.name}</strong><span>{item.description}</span>
          <small>{item.categories.map((id) => categories.find((cat) => cat.id === id)?.name).join(" · ")}</small>
        </button>)}</div>
        <a className="tpl-jump" href="#customize-template">Customize {active.name} ↓</a>
      </div></section>
      <section className="tpl-customize" id="customize-template"><div className="tpl-wrap tpl-workspace">
        <div className="tpl-settings"><h2>2. Make it yours</h2><p className="tpl-selected">{active.name}</p>
          <TemplateStyleControls style={style} onChange={setStyle} />
          <label className="tpl-field">Start with
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="sample">Sample details</option><option value="blank">Blank CV</option>
              {saved.map((item) => <option key={item.id} value={item.id}>{item.title || "Saved CV"}</option>)}
            </select>
          </label>
          <button className="tpl-primary" type="button" disabled={busy} onClick={() => start()}>{busy ? "Opening builder..." : "Use this template"}</button>
          {error && <p role="alert" className="tpl-warning">{error}</p>}
        </div>
        <div className="tpl-preview"><div className="tpl-preview-heading"><h2>Preview both pages</h2><small>A4 · Sample CV</small></div>
          <TemplatePreview cv={cv} style={style} demo sideBySide />
        </div>
      </div></section>
    </main>
    <footer className="tpl-footer"><div className="tpl-wrap"><span>BuildMyCVNow</span><nav aria-label="Footer"><a href="/faq">FAQ</a><a href="/blog">Career tips</a><a href="/privacy">Privacy</a></nav></div></footer>
  </div>;
}
