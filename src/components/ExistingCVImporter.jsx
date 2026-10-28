import React, { useEffect, useRef, useState } from 'react';
import { CV_FIELDS, validateUploadFile, validateCvImport, toBuilderImport } from '../lib/cvImportSchema.js';
import { startImportSession, uploadCv, organizeCv, clearImportSession } from '../lib/cvImportClient.js';
import './cvImporter.css';
const steps = ['Uploading', 'Extracting text', 'Organizing information', 'Ready for review'];
const longFields = new Set(['summary', 'education', 'skills', 'certifications', 'languages', 'projects', 'awards', 'volunteerExperience', 'references', 'unclassifiedContent', 'professionalLinks']);
const workFields = {
  jobTitle: 'Role',
  employer: 'Employer',
  companyLocation: 'Location',
  fromDate: 'Start date (as written)',
  toDate: 'End date (as written)',
  responsibilities: 'Responsibilities and achievements'
};
export default function ExistingCVImporter({
  onImport,
  currentCv,
  onRestore
}) {
  const [file, setFile] = useState(null),
    [source, setSource] = useState(null),
    [draft, setDraft] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [stage, setStage] = useState(-1),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false),
    [imported, setImported] = useState(false),
    [dragging, setDragging] = useState(false),
    [undoConfirm, setUndoConfirm] = useState(false);
  const abortRef = useRef(null),
    runRef = useRef(0),
    busyRef = useRef(false),
    backupRef = useRef(null),
    inputRef = useRef(null),
    reviewRef = useRef(null);
  const importedIds = useRef(new Set());
  const pendingClearRef = useRef(Promise.resolve());
  useEffect(() => () => {
    runRef.current++;
    abortRef.current?.abort();
  }, []);
  useEffect(() => setConfirmed(false), [currentCv]);
  useEffect(() => {
    if (!draft || imported) return;
    const warn = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft, imported]);
  const process = async (candidate = file, reuse = source) => {
    if (busyRef.current || !candidate) return;
    try {
      validateUploadFile(candidate);
    } catch (error) {
      setError(error.message);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError('');
    setConfirmed(false);
    setImported(false);
    const run = ++runRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const active = () => run === runRef.current && !controller.signal.aborted;
    try {
      let extracted = reuse;
      if (!extracted) {
        setStage(0);
        setProgress(0);
        await pendingClearRef.current;
        if (!active()) return;
        await startImportSession(controller.signal);
        extracted = await uploadCv(candidate, {
          signal: controller.signal,
          onProgress: value => {
            if (active()) setProgress(value);
          },
          onUploaded: () => {
            if (active()) setStage(1);
          }
        });
        if (!active()) return;
        setSource(extracted);
      }
      setStage(2);
      const organized = await organizeCv(extracted, controller.signal);
      if (!active()) return;
      validateCvImport(organized.cv);
      setDraft(organized.cv);
      setStage(3);
      setTimeout(() => reviewRef.current?.focus(), 0);
    } catch (error) {
      if (active()) {
        setError(error.message);
        if (['SESSION_EXPIRED', 'SOURCE_MISMATCH'].includes(error.code)) setSource(null);
      }
    } finally {
      if (run === runRef.current) {
        setBusy(false);
        busyRef.current = false;
      }
    }
  };
  const choose = files => {
    if (busyRef.current || source || draft) return;
    if (files.length !== 1) {
      setError('Choose one CV at a time.');
      return;
    }
    const candidate = files[0];
    try {
      validateUploadFile(candidate);
      setFile(candidate);
      process(candidate, null);
    } catch (error) {
      setError(error.message);
    }
  };
  const cancel = () => {
    runRef.current++;
    abortRef.current?.abort();
    busyRef.current = false;
    setBusy(false);
    setError('Processing cancelled. Your selected file and any extracted text remain available for retry.');
  };
  const clear = () => {
    cancel();
    setFile(null);
    setSource(null);
    setDraft(null);
    setError('');
    setStage(-1);
    setImported(false);
    setConfirmed(false);
    backupRef.current = null;
    if (inputRef.current) inputRef.current.value = '';
    pendingClearRef.current = clearImportSession();
  };
  const edit = (key, value) => {
    setDraft(current => ({
      ...current,
      [key]: value
    }));
    setConfirmed(false);
  };
  const editJob = (index, key, value) => {
    setDraft(current => ({
      ...current,
      workExperiences: current.workExperiences.map((job, i) => i === index ? {
        ...job,
        [key]: value
      } : job)
    }));
    setConfirmed(false);
  };
  const importReviewed = () => {
    if (!confirmed || imported || !draft || !source || importedIds.current.has(source.importId)) return;
    try {
      const payload = toBuilderImport(draft, source.importId);
      backupRef.current = structuredClone(currentCv);
      const accepted = onImport(payload, {
        importId: source.importId
      });
      if (accepted === false) return;
      importedIds.current.add(source.importId);
      setImported(true);
      setConfirmed(false);
      setError('');
    } catch (error) {
      setError(error.message);
    }
  };
  const reviewField = (key, label) => <label key={key} className={`cv-import-field ${longFields.has(key) ? 'cv-import-wide' : ''}`}><span>{label}</span>{longFields.has(key) ? <textarea dir="auto" rows={key === 'summary' ? 5 : 3} value={draft[key]} onChange={event => edit(key, event.target.value)} /> : <input dir="auto" value={draft[key]} onChange={event => edit(key, event.target.value)} />}</label>;
  return <section className="cv-importer" aria-labelledby="cv-import-banner-title">
    <div className="cv-import-banner"><span className="cv-import-banner-icon" aria-hidden="true">↑</span><div><h3 id="cv-import-banner-title">Already have a CV? Upload it and we fill the sections.</h3><p>PDF, DOCX, JPG or PNG · max 3 MB · English and Arabic · your wording is kept</p></div><button type="button" aria-expanded={expanded || Boolean(file)} aria-controls="cv-import-content" onClick={() => setExpanded(value => !value)}>{expanded && !file ? 'Hide upload' : 'Upload CV'}</button></div>
    <div id="cv-import-content" hidden={!expanded && !file}>
    <h3 id="cv-import-title">Upload Existing CV</h3><p>Import a PDF, DOCX, JPG, or PNG. Maximum 3 MB and 12 PDF pages. Review every field before changing your CV.</p>
    <p className="cv-import-note">Documents are processed privately on the server and by the configured AI provider. The upload service keeps no permanent copy. Your original file stays in this tab until cleared or you leave; imported fields use your existing builder saving settings.</p>
    <div className={`cv-import-drop ${dragging ? 'cv-import-drag' : ''}`} onDragOver={event => {
      event.preventDefault();
      if (!busy && !source && !draft) setDragging(true);
    }} onDragLeave={() => setDragging(false)} onDrop={event => {
      event.preventDefault();
      setDragging(false);
      choose(event.dataTransfer.files);
    }}>
      <strong>{file ? file.name : 'Drag and drop your CV here'}</strong><span>English and Arabic supported · Original wording is preserved</span>
      <label className="cv-import-browse">Browse CV files<input ref={inputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" disabled={busy || Boolean(source) || Boolean(draft)} onChange={event => choose(event.target.files)} /></label>
      {file && <small>{(file.size / 1024).toFixed(0)} KB selected. Clear this upload before choosing another.</small>}
    </div>
    {stage >= 0 && <ol className="cv-import-progress" aria-label="CV processing progress">{steps.map((label, i) => <li key={label} aria-current={stage === i ? 'step' : undefined} className={i <= stage ? 'active' : ''}>{i + 1}. {label}{stage === 0 && i === 0 ? ` (${progress}%)` : ''}</li>)}</ol>}
    <div role="status" aria-live="polite">{busy ? steps[Math.max(0, stage)] + '…' : imported ? 'Reviewed CV imported. Your source remains available below.' : draft ? 'Ready for review. Nothing has been changed in the builder yet.' : ''}</div>
    {error && <p className="cv-import-error" role="alert">{error}</p>}
    <div className="cv-import-actions">{busy ? <button type="button" onClick={cancel}>Cancel processing</button> : file && !draft ? <button type="button" onClick={() => process()}>{source ? 'Retry organizing retained text' : 'Retry processing selected file'}</button> : null}{file && !busy && <button type="button" onClick={clear}>Clear this upload</button>}</div>
    {source && <details className="cv-import-source" open={!draft}><summary>Original extracted text — retained throughout review</summary><p className="cv-import-note">Compare OCR text with your original file. OCR can misread characters. Embedded PDF text is also retained for comparison.</p>{source.source.pages.map(page => <div key={page.pageNumber}><h4>Page {page.pageNumber} · {page.method === 'ocr' ? 'OCR / layout analysis' : 'embedded text'}</h4><pre dir="auto">{page.text}</pre>{page.embeddedText && page.embeddedText !== page.text && <details><summary>Embedded text from this page</summary><pre dir="auto">{page.embeddedText}</pre></details>}</div>)}</details>}
    {draft && <div className="cv-import-review" ref={reviewRef} tabIndex={-1} aria-labelledby="cv-import-review-title">
      <h3 id="cv-import-review-title">Review and correct your CV</h3><p>Missing details are left blank. No translation or wording improvement is applied during import. Layout, photo, salary settings, and your cover letter are kept; review them separately if this CV belongs to someone else.</p>
      {(source.source.warnings.length > 0 || draft.uncertainties.length > 0) && <aside className="cv-import-warnings" aria-label="Information to check"><h4>Check these details</h4><ul>{source.source.warnings.map((message, i) => <li key={`warning-${i}`}>{message}</li>)}{draft.uncertainties.map((item, i) => <li key={`uncertain-${i}`}><strong>{CV_FIELDS[item.field] || item.field}</strong>: {item.reason}</li>)}</ul></aside>}
      <fieldset disabled={imported}><legend>Editable information</legend><div className="cv-import-fields">{Object.entries(CV_FIELDS).filter(([key]) => key !== 'unclassifiedContent').map(([key, label]) => reviewField(key, label))}<label className="cv-import-field"><span>Reading direction</span><select value={draft.languageDirection} onChange={event => edit('languageDirection', event.target.value)}><option value="ltr">Left to right</option><option value="rtl">Right to left (Arabic)</option></select></label></div>
      <h4>Work experience</h4>{draft.workExperiences.map((job, index) => <fieldset key={index} className="cv-import-job"><legend>Job {index + 1}</legend><div className="cv-import-fields">{Object.entries(workFields).map(([key, label]) => <label className={`cv-import-field ${key === 'responsibilities' ? 'cv-import-wide' : ''}`} key={key}><span>{label}</span>{key === 'responsibilities' ? <textarea dir="auto" rows={5} value={job[key]} onChange={event => editJob(index, key, event.target.value)} /> : <input dir="auto" value={job[key]} onChange={event => editJob(index, key, event.target.value)} />}</label>)}<label><input type="checkbox" checked={job.isCurrent} onChange={event => editJob(index, 'isCurrent', event.target.checked)} /> This is my current job</label></div><button type="button" onClick={() => {
            edit('workExperiences', draft.workExperiences.filter((_, i) => i !== index));
          }}>Remove job from reviewed fields</button></fieldset>)}<button type="button" onClick={() => edit('workExperiences', [...draft.workExperiences, {
          jobTitle: '',
          employer: '',
          companyLocation: '',
          fromDate: '',
          toDate: '',
          isCurrent: false,
          responsibilities: ''
        }])}>Add work experience</button>
      <div className="cv-import-fields">{reviewField('unclassifiedContent', CV_FIELDS.unclassifiedContent)}</div><p className="cv-import-note">Unclassified content is retained in the builder for editing. It is not printed automatically; move it into the appropriate CV section.</p>
      </fieldset>
      {!imported ? <><label className="cv-import-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I reviewed the extracted information and any uncertainties. Importing will replace the matching CV fields and work history currently in the builder, including replacing fields with blanks.</label><button type="button" className="cv-import-primary" disabled={!confirmed} onClick={importReviewed}>Confirm and import reviewed CV</button></> : <><p className="cv-import-success">Imported once. Continue editing in the builder below.</p>{backupRef.current && onRestore && <div><label className="cv-import-confirm"><input type="checkbox" checked={undoConfirm} onChange={event => setUndoConfirm(event.target.checked)} /> Restore my previous CV and discard builder edits made since this import.</label><button type="button" disabled={!undoConfirm} onClick={() => {
            onRestore(backupRef.current);
            importedIds.current.delete(source.importId);
            setImported(false);
            setUndoConfirm(false);
          }}>Undo this import</button></div>}</>}
    </div>}
    </div>
  </section>;
}
