// Abstract learning cues, never depictions of Allah or divine attributes.
const art = {
  fire: '<path d="M20 4c4 8-1 10 5 14l3-6c10 13 3 23-8 23S3 24 12 15c-1 8 3 7 5 5s2-7 3-16z"/>',
  elephant:
    '<path d="M7 30V17C7 4 29 4 29 17v8h5v8c-9 3-10-3-10-8M9 24v10h6V24M19 24v10h5M11 14c12-6 12 14 1 10z"/><circle cx="26" cy="14" r="1"/>',
  bird: '<path d="M5 22c7-17 16-1 20-8 5-6 9 0 8 6l5 2-6 2c-4 15-17 10-27-2zM8 22c5 9 15 7 16-2"/>',
  food: '<path d="M4 22h32c-2 16-30 16-32 0zM10 16c-5-5 5-6 0-11M20 16c-5-5 5-6 0-11M30 16c-5-5 5-6 0-11"/>',
  rope: '<path d="M12 4c25 0-15 13 9 15S0 34 28 36M18 4c25 0-15 13 9 15S6 34 34 36"/>',
  stone:
    '<path d="m6 26 5-17 17-3 8 15-8 14H12zM11 9l8 11 9-14M19 20l-7 15M19 20l17 1"/>',

  name: '<rect x="7" y="9" width="26" height="23" rx="6"/><path d="M13 17h14M13 24h8"/>',
  praise: '<path d="m20 5 4 10 11 1-8 7 2 11-9-6-9 6 2-11-8-7 11-1z"/>',
  worlds:
    '<circle cx="20" cy="20" r="14"/><ellipse cx="20" cy="20" rx="6" ry="14"/><path d="M7 15h26M7 25h26"/>',
  day: '<circle cx="20" cy="20" r="8"/><path d="M20 3v4M20 33v4M3 20h4M33 20h4M8 8l3 3M29 29l3 3M8 32l3-3M29 11l3-3"/>',
  judgment:
    '<path d="M20 7v27M10 34h20M7 13h26M9 13l-5 12h10zM31 13l-5 12h10z"/>',
  worship: '<path d="M8 31h24M12 31V17l8-8 8 8v14M17 31v-9h6v9"/>',
  help: '<path d="m5 24 8-8 7 4 7-7 8 7-14 13-8-3zM13 16l7-7 7 4"/>',
  path: '<path d="M12 36c-17-15 31-12 15-27M21 4l7 4-6 5M25 35c-14-11 23-12 6-24"/>',
  gift: '<rect x="7" y="17" width="26" height="18" rx="3"/><path d="M5 17h30v-6H5zM20 11v24M20 11c-17 0-12-14-5-7l5 7c17 0 12-14 5-7z"/>',
  people:
    '<circle cx="15" cy="12" r="5"/><circle cx="29" cy="15" r="4"/><path d="M5 32v-5a10 10 0 0 1 20 0v5M26 23a7 7 0 0 1 10 6v3"/>',
  not: '<circle cx="20" cy="20" r="14"/><path d="m10 30 20-20"/>',
  lost: '<path d="M20 35V19M20 22 9 12M20 19l11-9M6 12h9M31 6v9"/>',
  tree: '<path d="M20 24v12M13 36h14"/><path d="M20 4c-8-2-13 6-9 11-8 5-4 15 5 12 7 5 20-1 14-10 4-7-2-15-10-13z"/>',
  water:
    '<path d="M3 15q5-7 11 0t11 0t12 0M3 24q5-7 11 0t11 0t12 0M3 33q5-7 11 0t11 0t12 0"/>',
  moon: '<path d="M30 30A15 15 0 1 1 16 5c-7 13 1 25 14 25z"/>',
  book: '<path d="M20 10c-5-4-12-3-16-2v25c6-2 11-1 16 2 5-3 10-4 16-2V8c-5-1-11-2-16 2zM20 10v25"/>',
};
export function illustration(key) {
  return art[key]
    ? `<svg class="meaning-art" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${art[key]}</svg>`
    : "";
}
// Each boundary has a distinct height and curve. The left tab of word i
// has the exact profile of the right socket of word i+1 (Arabic RTL).
export function outline(index, total) {
  const edge = (k) => ({ y: 38 + (k % 4) * 18, r: 7 + (k % 3) * 2 });
  const left = edge(index),
    right = edge(index - 1);
  const incoming =
    index > 0
      ? `L168 ${right.y - right.r} C152 ${right.y - right.r} 152 ${right.y + right.r} 168 ${right.y + right.r}`
      : "";
  const outgoing =
    index < total - 1
      ? `L12 ${left.y + left.r} C-4 ${left.y + left.r} -4 ${left.y - left.r} 12 ${left.y - left.r}`
      : "";
  return `M24 5H156Q168 5 168 17${incoming}V123Q168 135 156 135H24Q12 135 12 123${outgoing}V17Q12 5 24 5Z`;
}
