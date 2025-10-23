// 1,000 funny responses without storing a giant array in git.
// We seed with a base list and generate variants.
const BASE = [
  "nommy nom", "nom nom nom", "evil nom", "nomest nom", "WOW BIG NOM!",
  "stealth nom", "quantum nom", "turbo nom", "crispy nom", "mystery nom",
  "spooky nom", "glorious nom", "hyper nom", "heckin nom", "nominator 3000",
  "ultra nom", "micro nom", "mega nom", "omega nom", "sneaky nom",
  "leftover nom", "forbidden nom", "emergency nom", "economy nom", "deluxe nom",
  "sauce-powered nom", "hands-free nom", "speedrun nom", "nom++", "nom.exe",
  "nom? nom!", "nom supreme", "holiday nom", "artisan nom", "free-range nom"
];

const TEMPLATES = [
  "⚡ {x}",
  "🍪 {x}",
  "💥 {x}!!!",
  "🌀 {x} time",
  "🔔 {x} alert",
  "👑 {x} of legends",
  "🎲 critical {x}",
  "🧪 experimental {x}",
  "🛰️ orbital {x}",
  "🧀 extra cheesy {x}",
  "🥐 flaky {x}",
  "🔥 flaming {x}",
  "🌟 premium {x}"
];

function buildVariants(base, target = 1000) {
  const out = new Set();
  const pick = a => a[(Math.random() * a.length) | 0];

  // Include base
  base.forEach(s => out.add(s));

  // Generate until target size
  while (out.size < target) {
    const b = pick(base);
    const t = Math.random() < 0.6 ? TEMPLATES[(Math.random() * TEMPLATES.length) | 0] : "{x}";
    let s = t.replace("{x}", b);
    // Add random suffixes/prefixes
    if (Math.random() < 0.3) s += " x" + (2 + (Math.random() * 4) | 0);
    if (Math.random() < 0.2) s = s.toUpperCase();
    out.add(s);
  }
  return Array.from(out);
}

export function initResponses(n = 1000) {
  return buildVariants(BASE, n);
}

export function getRandomResponse(arr) {
  return arr[(Math.random() * arr.length) | 0];
}
