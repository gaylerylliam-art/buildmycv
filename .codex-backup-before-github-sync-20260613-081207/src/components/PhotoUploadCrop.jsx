import React, { useEffect, useRef, useState } from "react";

const CROP_SIZE = 220;
const EXPORT_SIZE = 400;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const shapeRadius = (shape) => {
  if (shape === "circle" || shape === "round") return "50%";
  if (shape === "rounded") return "18px";
  return "4px";
};

const shapeLabel = (shape) => {
  if (shape === "circle" || shape === "round") return "Circle";
  if (shape === "rounded") return "Rounded";
  return "Square";
};

function clipRoundedRect(ctx, size, radius) {
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.clip();
}

export default function PhotoUploadCrop({ value, shape = "circle", onPhotoSaved, onPhotoRemoved }) {
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef({ dragging: false, x: 0, y: 0 });
  const [stage, setStage] = useState(value ? "preview" : "upload");
  const [message, setMessage] = useState("JPG, PNG, or WEBP up to 2 MB. Crop will export as a clean 400x400 PNG.");
  const [dragOver, setDragOver] = useState(false);
  const [photo, setPhoto] = useState(value || "");
  const [selectedShape, setSelectedShape] = useState(shape === "round" ? "circle" : shape);
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const draw = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
    ctx.filter = `brightness(${brightness}%)`;
    ctx.drawImage(image, offset.x, offset.y, image.naturalWidth * zoom, image.naturalHeight * zoom);
    ctx.filter = "none";
  };

  useEffect(() => {
    draw();
  }, [zoom, brightness, offset]);

  useEffect(() => {
    setPhoto(value || "");
    if (value) setStage("preview");
  }, [value]);

  useEffect(() => {
    setSelectedShape(shape === "round" ? "circle" : shape || "circle");
  }, [shape]);

  const loadFile = (file) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type)) {
      setMessage("Please upload a JPG, PNG, or WEBP photo.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setMessage("Photo is too large. Please choose an image under 2 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      const nextZoom = Math.max(CROP_SIZE / image.naturalWidth, CROP_SIZE / image.naturalHeight) * 1.05;
      setZoom(Number(nextZoom.toFixed(2)));
      setBrightness(100);
      setOffset({
        x: (CROP_SIZE - image.naturalWidth * nextZoom) / 2,
        y: (CROP_SIZE - image.naturalHeight * nextZoom) / 2,
      });
      setStage("crop");
      setMessage("Drag to reposition. Use zoom and brightness before saving.");
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      setMessage("Could not read this photo. Please try another image.");
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  const saveCrop = () => {
    const image = imageRef.current;
    if (!image) return;
    const output = document.createElement("canvas");
    output.width = EXPORT_SIZE;
    output.height = EXPORT_SIZE;
    const ctx = output.getContext("2d");
    const ratio = EXPORT_SIZE / CROP_SIZE;
    if (selectedShape === "circle") {
      ctx.beginPath();
      ctx.arc(EXPORT_SIZE / 2, EXPORT_SIZE / 2, EXPORT_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
    } else if (selectedShape === "rounded") {
      clipRoundedRect(ctx, EXPORT_SIZE, 42);
    }
    ctx.filter = `brightness(${brightness}%)`;
    ctx.drawImage(image, offset.x * ratio, offset.y * ratio, image.naturalWidth * zoom * ratio, image.naturalHeight * zoom * ratio);
    ctx.filter = "none";
    const dataUrl = output.toDataURL("image/png");
    setPhoto(dataUrl);
    setStage("preview");
    setMessage("Photo saved to your CV.");
    onPhotoSaved?.(dataUrl, selectedShape);
  };

  const removePhoto = () => {
    setPhoto("");
    imageRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
    setStage("upload");
    setMessage("Photo removed. Upload another photo when ready.");
    onPhotoRemoved?.();
  };

  const recrop = () => {
    if (imageRef.current) {
      setStage("crop");
      draw();
      return;
    }
    setStage("upload");
  };

  const beginDrag = (clientX, clientY) => {
    dragRef.current = { dragging: true, x: clientX, y: clientY };
  };

  const moveDrag = (clientX, clientY) => {
    if (!dragRef.current.dragging) return;
    const dx = clientX - dragRef.current.x;
    const dy = clientY - dragRef.current.y;
    dragRef.current = { dragging: true, x: clientX, y: clientY };
    setOffset((current) => ({ x: current.x + dx, y: current.y + dy }));
  };

  const endDrag = () => {
    dragRef.current.dragging = false;
  };

  useEffect(() => {
    const handleMove = (event) => moveDrag(event.clientX, event.clientY);
    const handleTouchMove = (event) => {
      if (!dragRef.current.dragging || !event.touches[0]) return;
      moveDrag(event.touches[0].clientX, event.touches[0].clientY);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", endDrag);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", endDrag);
    };
  }, []);

  const chooseFile = () => fileRef.current?.click();

  return (
    <section className="photo-crop-card">
      <div className="photo-crop-header">
        <h3>Profile photo</h3>
        <p>Upload, crop, and position your photo before adding it to your CV.</p>
      </div>

      {stage === "upload" && (
        <div
          className={`photo-dropzone ${dragOver ? "over" : ""}`}
          onClick={chooseFile}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            loadFile(event.dataTransfer.files?.[0]);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") chooseFile();
          }}
        >
          <span className="photo-drop-icon">+</span>
          <strong>Drag & drop your photo here</strong>
          <span>JPG, PNG, or WEBP</span>
          <button
            type="button"
            className="photo-crop-primary"
            onClick={(event) => {
              event.stopPropagation();
              chooseFile();
            }}
          >
            Choose file
          </button>
          <input ref={fileRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => loadFile(event.target.files?.[0])} />
        </div>
      )}

      {stage === "crop" && (
        <div className="photo-crop-stage">
          <div
            className="photo-crop-ring"
            style={{ borderRadius: shapeRadius(selectedShape) }}
            onMouseDown={(event) => beginDrag(event.clientX, event.clientY)}
            onTouchStart={(event) => {
              if (event.touches[0]) beginDrag(event.touches[0].clientX, event.touches[0].clientY);
            }}
          >
            <canvas ref={canvasRef} width={CROP_SIZE} height={CROP_SIZE} />
          </div>
          <div className="photo-crop-controls">
            <label>
              <span>Zoom</span>
              <input type="range" min="0.3" max="4" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
              <em>{Math.round(zoom * 100)}%</em>
            </label>
            <label>
              <span>Brightness</span>
              <input type="range" min="50" max="150" step="1" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} />
              <em>{brightness}%</em>
            </label>
            <div className="photo-shape-row">
              {["circle", "rounded", "square"].map((item) => (
                <button key={item} type="button" onClick={() => setSelectedShape(item)} className={selectedShape === item ? "selected" : ""}>
                  {shapeLabel(item)}
                </button>
              ))}
            </div>
            <div className="photo-action-row">
              <button type="button" className="photo-crop-secondary" onClick={removePhoto}>Change photo</button>
              <button type="button" className="photo-crop-primary" onClick={saveCrop}>Apply to CV</button>
            </div>
          </div>
        </div>
      )}

      {stage === "preview" && photo && (
        <div className="photo-saved-stage">
          <img src={photo} alt="Cropped CV profile" className={`photo-saved-preview ${selectedShape}`} />
          <span className="photo-saved-badge">Photo saved to your CV</span>
          <div className="photo-action-row">
            <button type="button" className="photo-crop-secondary" onClick={removePhoto}>Remove photo</button>
            <button type="button" className="photo-crop-primary" onClick={recrop}>Re-crop</button>
          </div>
        </div>
      )}

      <p className="photo-crop-message">{message}</p>
    </section>
  );
}
