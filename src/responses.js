/**
 * Generates a large list of funny "nom" responses by remixing base templates
 * with random adjectives, intensifiers, and punctuation.
 */

const BASE_RESPONSES = [
    "nommy nom",
    "nom nom nom",
    "evil nom",
    "holy nom",
    "mega nom",
    "WOW BIG NOM!",
    "stealth nom",
    "baby nom",
    "crispy nom",
    "double nom combo",
    "nom-inator",
    "dark nom rises",
    "nomzilla strikes again",
    "nomnomageddon",
    "legendary nom unlocked",
    "nom express",
    "nom.exe has stopped responding",
    "emergency nom protocol",
    "nomzilla approved",
    "professional nommer detected",
    "nom vibes only",
    "alpha nom",
    "nomnomnomnom",
    "nom but make it fashion",
    "quantum nom",
    "nom++",
    "spicy nom",
    "cosmic nom",
    "nomnado warning!",
    "classified nom moment",
    "nom initiated",
    "critical nom hit!",
    "nomstorm incoming",
    "tactical nom",
    "illegal levels of nom",
    "elite tier nom",
    "nom with extra sauce",
    "unholy nom fusion",
    "nom 2: Electric Boogaloo",
    "nomlocked and loaded",
    "nomception",
    "fast and the nomrious",
    "100% organic nom",
    "nom with fries",
    "infinite nom glitch",
    "nom zone activated",
    "stealth mode: nom",
    "this is a certified nom moment",
    "nom harder",
    "maximum overnom",
    "absolutely nomcore",
    "ultra instinct nom",
    "nom energy detected",
    "nom crisis event",
    "nom speedrun world record",
    "nom supremacy",
    "nom of the year",
    "return of the nom",
    "forbidden nom scrolls",
    "nom.exe initialized",
    "final boss: nom",
    "nom evolution achieved",
    "one does not simply out-nom",
    "nom achieved!",
    "nom protocol online",
    "behold, the nom",
    "prepare for nom",
    "extreme nom turbulence",
    "certified pre-owned nom",
    "nomwave engaged",
    "extra crunchy nom",
    "top secret nom",
    "mission: nompossible",
    "nom factory operational",
    "who summoned the nom?",
    "unlicensed nom",
    "unauthorized nom detected",
    "pls send more nom",
    "AI-generated nom",
    "nombot malfunction",
    "emotional support nom",
    "nomblast incoming",
    "infinite nom energy",
    "low battery. need nom.",
    "404 nom not found",
    "quantum nom collapse",
    "nomed and loaded",
    "respect the nom",
    "too many noms",
    "there is no spoon, only nom",
    "nom.exe executed successfully",
    "do not disturb: nom in progress",
    "nomgasm",
    "cosmic-level nom event detected",
    "world’s okayest nom",
    "thank you for your nom service",
    "speednom deluxe edition",
    "super nom bros",
    "ultra rare shiny nom",
    "official nom dealer",
    "final form nom",
    "certified gourmet nom",
    "rebooting nom core",
    "nom canon event",
    "omni-nom",
    "hotfix patch 1.0.1 — less crumbs",
    "big chonk nom",
    "nom approved by FDA",
    "nomalicious",
    "doctor said one nom per day",
    "warning: too nommy",
    "nom police on standby",
    "silent but deadly nom",
    "nom explosion imminent",
    "emergency snack protocol: nom",
    "unlimited nom works",
    "nom.exe update available",
    "recalculating... nom detected"
  ];
  
  /**
   * Randomly expands the base list to 1000 with stylistic variants.
   */
  export function initResponses(requestedCount = 1000) {
    const results = [];
  
    const emojis = ["😋", "🍪", "🔥", "🥐", "🍩", "💥", "✨", "💫", "🚀", "😈", "🤖", "🍫", "🌈", "🎯", "🥯", "🍕", "🧃"];
    const suffixes = [
      "", "!!", "!!!", ".", "...", "?!", "?!?", "~", "?! NOM?!", "?! WOW!", "?!?!"
    ];
    const prefixes = [
      "", "uh oh...", "alert:", "breaking:", "yo,", "uhm,", "behold:", "update:", "exclusive:", "🔥"
    ];
  
    for (let i = 0; results.length < requestedCount; i++) {
      const base = BASE_RESPONSES[Math.floor(Math.random() * BASE_RESPONSES.length)];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  
      const variant = `${prefix ? prefix + " " : ""}${base}${suffix ? suffix : ""} ${emoji}`.trim();
      results.push(variant);
    }
  
    return results.slice(0, requestedCount);
  }
  
  export function getRandomResponse(list) {
    return list[Math.floor(Math.random() * list.length)];
  }
  