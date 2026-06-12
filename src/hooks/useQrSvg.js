import { useEffect, useState } from "react";
import QRCode from "qrcode";

const sanitizeSvg = (svg = "") =>
  String(svg)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");

export function sanitizeQrSvg(svg = "") {
  return sanitizeSvg(svg);
}

export function useQrSvg(url, color = "#1E293B") {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    if (!url) {
      setSvg("");
      return undefined;
    }
    let ignore = false;
    const timer = window.setTimeout(async () => {
      try {
        const nextSvg = await QRCode.toString(url, {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 0,
          color: { dark: color, light: "#FFFFFF00" },
        });
        if (!ignore) setSvg(sanitizeSvg(nextSvg));
      } catch {
        if (!ignore) setSvg("");
      }
    }, 600);
    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [url, color]);

  return svg;
}
