/** Redimensiona a imagem no navegador (máx. 1600 px) e devolve um data URL JPEG. */
export async function resizeImage(source: File | string, maxSize = 1600): Promise<string> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas indisponível");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}
