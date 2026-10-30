// Where a cover-cropped image actually lands, and where a point on it lands
// with it. Hotspots and zoom focal points are stored normalised to the image
// (design-system/v2/05-room.md); these place them on screen at any aspect
// ratio (handoff 03 §3).

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The rendered rectangle of an `object-fit: cover` image, centred, in container pixels. */
export function coverRect(containerW: number, containerH: number, imageW: number, imageH: number): Rect {
  const scale = Math.max(containerW / imageW, containerH / imageH);
  const w = imageW * scale;
  const h = imageH * scale;
  return { x: (containerW - w) / 2, y: (containerH - h) / 2, w, h };
}

/** A normalised image point, in container pixels. */
export function placePoint(rect: Rect, nx: number, ny: number): { x: number; y: number } {
  return { x: rect.x + nx * rect.w, y: rect.y + ny * rect.h };
}

/** Whether a container point is on screen, with a margin for a label's size. */
export function onScreen(p: { x: number; y: number }, containerW: number, containerH: number, margin = 0): boolean {
  return p.x >= margin && p.x <= containerW - margin && p.y >= margin && p.y <= containerH - margin;
}
