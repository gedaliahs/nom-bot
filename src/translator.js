// "Nom Translator" — playful but readable.
export function nomTranslate(input) {
    if (!input || typeof input !== "string") return "nom";
    const words = input.split(/\s+/);
    return words
      .map(w => {
        // Keep punctuation
        const core = w.replace(/[^a-zA-Z]/g, "");
        if (!core) return w;
        const len = Math.max(1, Math.min(4, Math.ceil(core.length / 3)));
        const flavor = ["nom", "nyom", "gnom", "nomf"][Math.floor(Math.random() * 4)];
        const out = flavor + (len > 1 ? " ".repeat(0) : "") + (len > 1 ? " nom".repeat(len - 1) : "");
        // Preserve trailing punctuation
        const punct = w.slice(core.length);
        return out + punct;
      })
      .join(" ");
  }
  
  