/**
 * “Good” Nom Translator:
 * - Preserves punctuation, numbers, and spacing
 * - Keeps capitalization shape
 * - Translates alphabetic syllables to nom-ish phonemes
 */
const syllables = [
    ["tion","shon"],["sion","zhon"],["qu","kw"],["ch","ch"],["ph","f"],
    ["th","t"],["ck","k"],["sch","sk"],["ght","t"],["x","ks"],
  ];
  const letters = {
    a:"na", e:"ne", i:"ni", o:"no", u:"nu", y:"ny",
    b:"nb", c:"nc", d:"nd", f:"nf", g:"ng", h:"nh",
    j:"nj", k:"nk", l:"nl", m:"nm", n:"n", p:"np",
    q:"nq", r:"nr", s:"ns", t:"nt", v:"nv", w:"nw", z:"nz"
  };
  
  function shapeCase(src, repl) {
    // match ALL CAPS or Capitalized or lower
    if (src.toUpperCase() === src) return repl.toUpperCase();
    if (src[0] && src[0] === src[0].toUpperCase()) return repl[0].toUpperCase() + repl.slice(1);
    return repl;
  }
  
  export function nomTranslate(input) {
    // Split by word boundaries but keep tokens
    return input.split(/(\b)/).map(tok => {
      if (!/[A-Za-z]/.test(tok)) return tok; // keep punctuation/space/numbers intact
  
      let lower = tok.toLowerCase();
  
      // apply syllables first
      for (const [pat, rep] of syllables) {
        lower = lower.replaceAll(pat, rep);
      }
  
      // per-letter mapping
      let out = "";
      for (const ch of lower) {
        if (letters[ch]) out += letters[ch];
        else if (/[a-z]/.test(ch)) out += "n"; // fallback for unknown letters
        else out += ch;
      }
  
      // compress repeating 'n' blocks into tasteful "nom" chunks
      out = out
        .replace(/n{2,}/g, "nom")
        .replace(/non/g, "nom")
        .replace(/nomo+/g, "nom")
        .replace(/nomnomnomnom/g, "nomnom");
  
      // add flair
      if (out.length > 6 && Math.random() < 0.15) out += " nom";
      return shapeCase(tok, out);
    }).join("");
  }
  