function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

export function createActionIcon(size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.clearRect(0, 0, size, size);

  const s = size / 32;

  // One bold blue browser-tab cue behind the document.
  ctx.fillStyle = "#2384f5";
  ctx.strokeStyle = "#1455a4";
  ctx.lineWidth = Math.max(1, 2 * s);
  roundedRect(ctx, 1.5 * s, 2 * s, 21 * s, 19 * s, 5 * s);
  ctx.fill();
  ctx.stroke();

  // Foreground Notion-like document tile. It deliberately occupies almost
  // the whole canvas so the toolbar icon remains legible at 16 px.
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1.4, 2.3 * s);
  roundedRect(ctx, 7 * s, 6.5 * s, 24 * s, 24 * s, 4.2 * s);
  ctx.fill();
  ctx.stroke();

  // Oversized N: no fine detail at toolbar sizes.
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.round(19 * s)}px Georgia, serif`;
  ctx.fillText("N", 19 * s, 19.4 * s);

  return ctx.getImageData(0, 0, size, size);
}

export async function applyActionIcon() {
  if (typeof OffscreenCanvas === "undefined") return;
  await chrome.action.setIcon({
    imageData: {
      16: createActionIcon(16),
      32: createActionIcon(32)
    }
  });
}
