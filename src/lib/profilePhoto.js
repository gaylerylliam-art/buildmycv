export const PASSPORT_PHOTO = Object.freeze({ format: "passport-35x45", widthMm: 35, heightMm: 45, width: 420, height: 540 });
export const normalizePhotoShape = (shape = "circle") => shape === "round" || shape === "circle" ? "circle" : shape === "rounded" ? "rounded" : "square";
export const photoRadius = shape => normalizePhotoShape(shape) === "circle" ? "50%" : normalizePhotoShape(shape) === "rounded" ? "12%" : "0";

export function getPassportPhotoStyles(cv = {}) {
  const framed = cv.photoFrameFormat === PASSPORT_PHOTO.format;
  return {
    frame: { width: "35mm", height: "45mm", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
    image: { display: "block", width: "35mm", height: framed ? "45mm" : "35mm", objectFit: framed ? "contain" : "cover", borderRadius: framed ? "0" : photoRadius(cv.photoShape), border: "0", boxShadow: "none", background: "transparent", flex: "0 0 auto" },
  };
}

// A true circle or square occupies the same centered 35 mm crop inside the 35 x 45 mm area.
export function drawPassportPhoto(context, image, shape = "circle") {
  const {width, height} = PASSPORT_PHOTO, top = (height - width) / 2;
  const sourceWidth = image.naturalWidth || image.width, sourceHeight = image.naturalHeight || image.height;
  const size = Math.min(sourceWidth, sourceHeight);
  context.clearRect(0, 0, width, height);
  context.save();
  context.beginPath();
  if (normalizePhotoShape(shape) === "circle") context.arc(width / 2, height / 2, width / 2, 0, Math.PI * 2);
  else if (normalizePhotoShape(shape) === "rounded") context.roundRect(0, top, width, width, width * .12);
  else context.rect(0, top, width, width);
  context.clip();
  context.drawImage(image, (sourceWidth - size) / 2, (sourceHeight - size) / 2, size, size, 0, top, width, width);
  context.restore();
}

export const loadPhotoImage = source => new Promise((resolve, reject) => {
  const image = new Image();
  if (!source.startsWith("data:") && !source.startsWith("blob:")) image.crossOrigin = "anonymous";
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error("Could not read this photo. Please choose another image."));
  image.src = source;
});

export async function framePhotoSource(source, shape) {
  const image = await loadPhotoImage(source), canvas = document.createElement("canvas");
  canvas.width = PASSPORT_PHOTO.width; canvas.height = PASSPORT_PHOTO.height;
  drawPassportPhoto(canvas.getContext("2d"), image, shape);
  return canvas.toDataURL("image/png");
}
