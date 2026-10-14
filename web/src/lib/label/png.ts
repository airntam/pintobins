import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import { PNG_H, PNG_W } from './render';

/** Rasterise the PNG-variant SVG at 203 dpi (559 × 640 px) to RGBA pixels. */
export function rasterize(svg: string) {
  const img = new Resvg(svg, { font: { loadSystemFonts: false } }).render();
  return { width: img.width, height: img.height, pixels: img.pixels };
}

/** Pure black-and-white, 8-bit greyscale PNG (thermal printers want hard edges). */
export function svgToPng(svg: string): Buffer {
  const { width, height, pixels } = rasterize(svg);
  const out = new PNG({ width, height, colorType: 0, inputColorType: 0, inputHasAlpha: false });
  for (let i = 0; i < width * height; i++) {
    const lum = (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 3;
    out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = lum < 140 ? 0 : 255;
    out.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(out, { colorType: 0, inputColorType: 6, inputHasAlpha: true });
}

export const PNG_SIZE = { width: PNG_W, height: PNG_H };
