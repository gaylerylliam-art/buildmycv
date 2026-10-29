import React, { useEffect, useRef, useState } from "react";
import { PASSPORT_PHOTO, drawPassportPhoto, framePhotoSource, loadPhotoImage, normalizePhotoShape, photoRadius } from "../lib/profilePhoto.js";

const CROP_SIZE = 220;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function PhotoUploadCrop({ value, cropSource = "", shape = "circle", onPhotoSaved, onPhotoRemoved, onShapeChanged }) {
  const canvasRef = useRef(null), fileRef = useRef(null), imageRef = useRef(null), loadId = useRef(0), frameId = useRef(0);
  const [stage, setStage] = useState(value ? "preview" : "upload");
  const [photo, setPhoto] = useState(value || ""), [selectedShape, setSelectedShape] = useState(normalizePhotoShape(shape));
  const [message, setMessage] = useState(""), [dragOver, setDragOver] = useState(false);
  const [zoom, setZoom] = useState(1), [minZoom, setMinZoom] = useState(1), [brightness, setBrightness] = useState(100);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const clampOffset = (next, scale = zoom) => {
    const image = imageRef.current;
    return image ? { x: Math.max(CROP_SIZE - image.naturalWidth * scale, Math.min(0, next.x)), y: Math.max(CROP_SIZE - image.naturalHeight * scale, Math.min(0, next.y)) } : next;
  };
  useEffect(() => {
    const canvas = canvasRef.current, image = imageRef.current;
    if (!canvas || !image || stage !== "crop") return;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
    context.filter = `brightness(${brightness}%)`;
    context.drawImage(image, offset.x, offset.y, image.naturalWidth * zoom, image.naturalHeight * zoom);
    context.filter = "none";
  }, [stage, zoom, brightness, offset]);
  useEffect(() => {
    setPhoto(value || "");
    setStage(current => current === "crop" ? current : value ? "preview" : "upload");
  }, [value]);
  useEffect(() => { setSelectedShape(normalizePhotoShape(shape)); }, [shape]);
  useEffect(() => () => { loadId.current++; frameId.current++; }, []);

  const beginCrop = image => {
    imageRef.current = image;
    const fit = Math.max(CROP_SIZE / image.naturalWidth, CROP_SIZE / image.naturalHeight);
    setMinZoom(fit); setZoom(fit); setBrightness(100);
    setOffset({ x: (CROP_SIZE - image.naturalWidth * fit) / 2, y: (CROP_SIZE - image.naturalHeight * fit) / 2 });
    setStage("crop"); setMessage("");
  };
  const loadFile = async file => {
    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type)) { setMessage("Please choose a JPG, PNG, or WEBP photo."); return; }
    if (file.size > MAX_FILE_SIZE) { setMessage("Photo is too large. Please choose an image under 2 MB."); return; }
    const id = ++loadId.current, url = URL.createObjectURL(file);
    try { const image = await loadPhotoImage(url); if (id === loadId.current) beginCrop(image); }
    catch (error) { if (id === loadId.current) setMessage(error.message); }
    finally { URL.revokeObjectURL(url); if (fileRef.current) fileRef.current.value = ""; }
  };
  const saveCrop = () => {
    if (!canvasRef.current || !imageRef.current) return;
    const crop = document.createElement("canvas");
    crop.width = PASSPORT_PHOTO.width; crop.height = PASSPORT_PHOTO.width;
    crop.getContext("2d").drawImage(canvasRef.current, 0, 0, crop.width, crop.height);
    const output = document.createElement("canvas");
    output.width = PASSPORT_PHOTO.width; output.height = PASSPORT_PHOTO.height;
    drawPassportPhoto(output.getContext("2d"), crop, selectedShape);
    const dataUrl = output.toDataURL("image/png"), source = crop.toDataURL("image/png");
    setPhoto(dataUrl); setStage("preview"); setMessage("Photo saved to your CV.");
    onPhotoSaved?.({ dataUrl, cropSource: source, shape: selectedShape, format: PASSPORT_PHOTO.format });
  };
  const changeShape = async next => {
    setSelectedShape(next);
    if (!photo || stage === "crop") { if (!photo) onShapeChanged?.(next); return; }
    if (!cropSource) { setSelectedShape(normalizePhotoShape(shape)); setMessage("Choose the original photo to change its frame without losing cropped corners."); return; }
    const id = ++frameId.current;
    try {
      const dataUrl = await framePhotoSource(cropSource, next);
      if (id !== frameId.current) return;
      setPhoto(dataUrl); setMessage("Photo frame updated.");
      onPhotoSaved?.({ dataUrl, cropSource, shape: next, format: PASSPORT_PHOTO.format });
    } catch (error) { if (id === frameId.current) setMessage(error.message); }
  };
  const recrop = async () => {
    if (imageRef.current) { beginCrop(imageRef.current); return; }
    try { beginCrop(await loadPhotoImage(cropSource || value)); }
    catch (error) { setMessage(error.message); }
  };
  const removePhoto = () => {
    loadId.current++; frameId.current++; imageRef.current = null;
    setPhoto(""); setStage("upload"); setMessage("Photo removed.");
    onPhotoRemoved?.();
  };
  const changeZoom = next => {
    const scale = Math.max(minZoom, Math.min(minZoom * 4, next)), factor = scale / zoom;
    setOffset(clampOffset({ x: CROP_SIZE / 2 - (CROP_SIZE / 2 - offset.x) * factor, y: CROP_SIZE / 2 - (CROP_SIZE / 2 - offset.y) * factor }, scale));
    setZoom(scale);
  };
  const dragStart = event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY };
  };
  const dragMove = event => {
    if (!dragRef.current) return;
    const ratio = CROP_SIZE / event.currentTarget.getBoundingClientRect().width;
    const dx = (event.clientX - dragRef.current.x) * ratio, dy = (event.clientY - dragRef.current.y) * ratio;
    dragRef.current = { x: event.clientX, y: event.clientY };
    setOffset(current => clampOffset({x: current.x + dx, y: current.y + dy}));
  };
  return <section className="photo-crop-card" aria-label="Profile photo settings">
    <header className="photo-crop-header"><h3>Profile photo</h3><p>Photo area: 35 x 45 mm</p></header>
    <input ref={fileRef} className="hidden" type="file" aria-label="Choose profile photo" accept="image/jpeg,image/png,image/webp" onChange={event => loadFile(event.target.files?.[0])} />
    <fieldset className="photo-frame-options"><legend>Frame</legend><div className="photo-shape-row">
      {[["circle","Round"],["square","Square"],["rounded","Rounded"]].map(([id,label]) => <button key={id} type="button" className={selectedShape === id ? "selected" : ""} aria-pressed={selectedShape === id} onClick={() => changeShape(id)}><span className={`photo-frame-symbol ${id}`} aria-hidden="true" />{label}</button>)}
    </div></fieldset>
    {stage === "upload" && <div className={`photo-dropzone ${dragOver ? "over" : ""}`} onDragOver={event => {event.preventDefault();setDragOver(true);}} onDragLeave={() => setDragOver(false)} onDrop={event => {event.preventDefault();setDragOver(false);loadFile(event.dataTransfer.files?.[0]);}}>
      <strong>Add a photo</strong><span>JPG, PNG or WEBP / up to 2 MB</span><button type="button" className="photo-crop-primary" onClick={() => fileRef.current?.click()}>Upload photo</button>
    </div>}
    {stage === "crop" && <div className="photo-crop-stage">
      <div className="photo-crop-ring" style={{borderRadius:photoRadius(selectedShape)}} onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={() => {dragRef.current=null;}} onPointerCancel={() => {dragRef.current=null;}}><canvas ref={canvasRef} width={CROP_SIZE} height={CROP_SIZE} /></div>
      <div className="photo-crop-controls">
        <label><span>Zoom</span><input aria-label="Photo zoom" type="range" min={minZoom} max={minZoom*4} step={minZoom/100} value={zoom} onChange={event => changeZoom(Number(event.target.value))} /><em>{Math.round(zoom/minZoom*100)}%</em></label>
        <label><span>Brightness</span><input aria-label="Photo brightness" type="range" min="50" max="150" step="1" value={brightness} onChange={event => setBrightness(Number(event.target.value))} /><em>{brightness}%</em></label>
        <div className="photo-pan-controls" role="group" aria-label="Move photo"><button type="button" aria-label="Move photo left" title="Move photo left" onClick={() => setOffset(current => clampOffset({...current,x:current.x-8}))}>&larr;</button><button type="button" aria-label="Move photo up" title="Move photo up" onClick={() => setOffset(current => clampOffset({...current,y:current.y-8}))}>&uarr;</button><button type="button" aria-label="Move photo down" title="Move photo down" onClick={() => setOffset(current => clampOffset({...current,y:current.y+8}))}>&darr;</button><button type="button" aria-label="Move photo right" title="Move photo right" onClick={() => setOffset(current => clampOffset({...current,x:current.x+8}))}>&rarr;</button></div>
        <div className="photo-action-row"><button type="button" className="photo-crop-secondary" onClick={() => {setSelectedShape(normalizePhotoShape(shape));setStage(photo ? "preview" : "upload");}}>Cancel</button><button type="button" className="photo-crop-primary" onClick={saveCrop}>Apply to CV</button></div>
      </div>
    </div>}
    {stage === "preview" && photo && <div className="photo-saved-stage"><img src={photo} alt="Saved profile photo" className="photo-saved-passport" /><span className="photo-saved-badge">35 x 45 mm photo area</span><div className="photo-action-row"><button type="button" className="photo-crop-secondary" onClick={removePhoto}>Remove photo</button><button type="button" className="photo-crop-primary" onClick={recrop}>Re-crop</button></div><button type="button" className="photo-crop-secondary" onClick={() => fileRef.current?.click()}>Replace photo</button></div>}
    {message && <p className="photo-crop-message" role="status">{message}</p>}
  </section>;
}
