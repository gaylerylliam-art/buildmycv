import fs from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true, watch: null, ws: false } });
try {
  const { blogCatalog } = await server.ssrLoadModule("/src/content/blogCatalog.js");
  const assets = new Map(blogCatalog.filter(({ media }) => media.src !== media.splash)
    .map(({ media }) => [media.splash, media.src]));
  for (const [output, source] of assets) {
    const image = await loadImage(`public${source}`);
    const width = Math.min(720, image.width);
    const canvas = createCanvas(width, Math.round(image.height * width / image.width));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const target = `public${output}`;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, await canvas.encode("webp", 79));
  }
  console.log(`Generated ${assets.size} career-guide splash images.`);
} finally {
  await server.close();
}
