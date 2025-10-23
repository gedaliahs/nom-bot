export function seasonalTag() {
    const month = new Date().getMonth() + 1; // 1–12
    const seasons = {
      1: "❄️ Frosted Nom Season",
      2: "💖 Sweetheart Nom Month",
      3: "🌸 Spring Noms",
      4: "🌷 Passover Noms",
      5: "🌼 Sunny Noms",
      6: "🔥 Summer Noms",
      7: "🍉 Juicy Noms",
      8: "☀️ Hot Nom Days",
      9: "🍂 Autumn Noms",
      10: "🎃 Spooky Noms",
      11: "🕎 Festival of Noms",
      12: "🎁 Holiday Noms"
    };
    return seasons[month] || "Nom Season";
  }
  