import fs from "node:fs/promises";
import puppeteer from "puppeteer-core";

// Natural Earth 1:110m land data is public domain; no reference-site assets are used.
const source = process.argv[2] || "artifacts/natural-earth-land.geojson";
const data = JSON.parse(await fs.readFile(source, "utf8"));
const polygons = data.features.flatMap(({ geometry }) => geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates);
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const points = [];
for (let lat = -58; lat <= 82; lat += 1.8) {
  const step = 1.8 / Math.cos(lat * Math.PI / 180);
  for (let lon = -180; lon < 180; lon += step) {
    if (polygons.some(([outer, ...holes]) => inRing(lon, lat, outer) && !holes.some((hole) => inRing(lon, lat, hole)))) {
      points.push([Number(lat.toFixed(2)), Number(lon.toFixed(2))]);
    }
  }
}
await fs.writeFile("public/assets/globe-land-points.json", JSON.stringify(points));
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<canvas width="600" height="600"></canvas>');
  const url = await page.evaluate((points) => {
    const canvas = document.querySelector("canvas"), ctx = canvas.getContext("2d");
    ctx.fillStyle = "#edf6f4";
    ctx.beginPath(); ctx.arc(300, 300, 252, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#b8d8d1"; ctx.lineWidth = 1;
    for (const radius of [90, 170, 230, 252]) {
      ctx.beginPath(); ctx.ellipse(300, 300, radius, 252, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (const offset of [-170, -85, 0, 85, 170]) {
      ctx.beginPath(); ctx.ellipse(300, 300 + offset, Math.sqrt(252 ** 2 - offset ** 2), 24, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (const [lat, lon] of points) {
      const a = lat * Math.PI / 180, b = (lon - 30) * Math.PI / 180;
      const z = Math.cos(a) * Math.cos(b);
      if (z <= 0) continue;
      ctx.fillStyle = `rgba(22,120,85,${0.35 + z * 0.65})`;
      ctx.beginPath(); ctx.arc(300 + 252 * Math.cos(a) * Math.sin(b), 300 - 252 * Math.sin(a), 1.6, 0, Math.PI * 2); ctx.fill();
    }
    return canvas.toDataURL("image/png");
  }, points);
  await fs.writeFile("public/assets/globe-static.png", Buffer.from(url.split(",")[1], "base64"));
} finally { await browser.close(); }
console.log(`Generated globe assets with ${points.length} land points.`);
