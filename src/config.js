// Tunables for rare events
export const RARE = {
    // 1 / CHANCE_DENOMINATOR = trigger chance per qualifying message
    CHANCE_DENOMINATOR: 200,
  
    // Cooldown so rare events don't spam (per guild)
    COOLDOWN_MS: 60_000,
  
    // If you want to award a special role on a rare proc, put the role ID here.
    // Leave null/"" to disable.
    GOLDEN_ROLE_ID: process.env.GOLDEN_ROLE_ID || "",
  
    // Static GIFs to avoid external APIs
    GIFS: [
      "https://media.tenor.com/0bCq2b-8zJIAAAAC/cat-eating.gif",
      "https://media.tenor.com/1p2k1m1bFgcAAAAC/nom-nom.gif",
      "https://media.tenor.com/2T5dE0q2yHIAAAAC/hamster-nom.gif",
      "https://media.tenor.com/1rVv3x8t1DcAAAAC/cookie-monster-cookie.gif",
      "https://media.tenor.com/1n_6bB3s8xEAAAAC/food-time.gif"
    ],
  
    // Reaction bursts — bot randomly reacts with a few of these
    REACTIONS: ["😋", "🍪", "🍩", "🥐", "🔥", "💫", "🚀", "🍕", "✨", "😈"],
  
    // Status rotation lines for the status flare event
    STATUS_LINES: [
      "WOW BIG NOM!",
      "legendary nom unlocked",
      "quantum nom engaged",
      "nom nom nom nom",
      "golden nom appears…"
    ]
  };
  