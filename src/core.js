export const TAU = Math.PI * 2;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const distanceSq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function normalize(x, y) {
  const length = Math.hypot(x, y);
  return length ? { x: x / length, y: y / length, length } : { x: 0, y: 0, length: 0 };
}

export function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function xpForLevel(level) {
  return Math.floor(8 + level * 4.4 + level ** 1.45);
}

export function spawnInterval(time) {
  return clamp(.68 - time * .0017, .11, .68);
}

export function phaseAt(time) {
  if (time < 90) return { wave: 1, name: 'ВНЕШНИЙ КРУГ', tint: 0 };
  if (time < 210) return { wave: 2, name: 'МАШИННЫЙ САД', tint: 1 };
  if (time < 330) return { wave: 3, name: 'ХРАМ ПОМЕХ', tint: 2 };
  return { wave: 4, name: 'СЕРДЦЕ КОРОНЫ', tint: 3 };
}

export function chooseUnique(items, count, random = Math.random) {
  const pool = [...items];
  const result = [];
  while (pool.length && result.length < count) {
    result.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return result;
}

export function weightedPick(entries, random = Math.random) {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  let point = random() * total;
  for (const entry of entries) {
    point -= Math.max(0, entry.weight);
    if (point <= 0) return entry.value;
  }
  return entries.at(-1)?.value;
}

export function circleHit(a, b) {
  const radius = a.radius + b.radius;
  return distanceSq(a, b) <= radius * radius;
}

export function absorbDamage(target, amount) {
  const blocked = Math.min(target.shield || 0, amount);
  target.shield = Math.max(0, (target.shield || 0) - blocked);
  target.hp = Math.max(0, target.hp - amount + blocked);
  return amount - blocked;
}

export function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
