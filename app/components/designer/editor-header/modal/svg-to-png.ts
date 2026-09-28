/**
 * Rasterize an SVG document to a PNG, in the browser: load it as an image, draw
 * it to a canvas, encode. `scale` is the pixel density -- 2 reads sharply on a
 * retina screen and in a slide deck -- and is lowered as far as it has to be to
 * keep the canvas inside what browsers will allocate, since a large diagram at
 * 2x is past the limit and `toBlob` then fails with nothing to say why.
 */
const MAX_SIDE = 16_384;
const MAX_AREA = 16_384 * 16_384 / 4;

export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const { naturalWidth: width, naturalHeight: height } = image;
    const fitted = Math.min(scale, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_AREA / (width * height)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(width * fitted));
    canvas.height = Math.max(1, Math.floor(height * fitted));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The diagram is too large to render as a PNG."))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
