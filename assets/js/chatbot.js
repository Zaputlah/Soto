// Chatbot (local-model-only)
// Answers are generated from assets/model.json only. No external API calls.

const chatbotToggle = document.getElementById("chatbotToggle");
const chatbotClose = document.getElementById("chatbotClose");
const chatbotPanel = document.getElementById("chatbotPanel");
const chatbotMessages = document.getElementById("chatbotMessages");
const chatbotInput = document.getElementById("chatbotInput");
const chatbotSend = document.getElementById("chatbotSend");
const chatbotSendLabel = chatbotSend
  ? chatbotSend.querySelector(".chatbot-send-label")
  : null;
const chatbotReset = document.getElementById("chatbotReset");
const chatbotSuggestions = document.getElementById("chatbotSuggestions");
const chatbotApiKeyInput = document.getElementById("chatbotApiKey");
const chatbotSaveKey = document.getElementById("chatbotSaveKey");

let MODEL_CONTEXT = null;
let CHAT_CONTEXT = createConversationContext();

// Load local model. The version prevents stale menu data from browser cache.
fetch("assets/model.json?v=20260607-13", { cache: "no-store" })
  .then((res) => res.json())
  .then((m) => {
    MODEL_CONTEXT = m;
  })
  .catch((err) => console.warn("Could not load model.json", err));

function appendMessage(role, text) {
  if (!chatbotMessages) return;
  const message = document.createElement("div");
  message.className = `chatbot-message ${role}`;

  if (role === "bot") {
    const avatar = document.createElement("div");
    avatar.className = "chatbot-message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "S";
    message.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = `chatbot-bubble ${role}`;
  bubble.textContent = text;
  message.appendChild(bubble);
  chatbotMessages.appendChild(message);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function setLoading(loading) {
  if (!chatbotSend || !chatbotInput) return;
  chatbotSend.disabled = loading;
  chatbotInput.disabled = loading;
  chatbotSend.classList.toggle("is-loading", loading);
  chatbotSend.setAttribute(
    "aria-label",
    loading ? "Sedang mengirim pesan" : "Kirim pesan",
  );
  if (chatbotSendLabel) {
    chatbotSendLabel.textContent = loading ? "Mengirim" : "Kirim";
  }
}

function openChatbot() {
  if (!chatbotPanel) return;
  chatbotPanel.classList.add("chatbot-open");
  chatbotPanel.setAttribute("aria-hidden", "false");
  if (chatbotToggle) {
    chatbotToggle.setAttribute("aria-expanded", "true");
    chatbotToggle.classList.add("is-panel-open");
  }
  window.setTimeout(() => {
    if (chatbotInput) chatbotInput.focus();
  }, 120);
}

function closeChatbot() {
  if (!chatbotPanel) return;
  chatbotPanel.classList.remove("chatbot-open");
  chatbotPanel.setAttribute("aria-hidden", "true");
  if (chatbotToggle) {
    chatbotToggle.setAttribute("aria-expanded", "false");
    chatbotToggle.classList.remove("is-panel-open");
  }
}

function normalize(s) {
  const typoMap = {
    ap: "apa",
    brp: "berapa",
    hrg: "harga",
    mhal: "mahal",
    mnu: "menu",
    murh: "murah",
    palling: "paling",
    pling: "paling",
    yg: "yang",
  };

  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => typoMap[word] || word)
    .join(" ");
}

function containsAny(text, words) {
  const q = normalize(text);
  return words.some((word) => {
    const normalizedWord = normalize(word);
    return q === normalizedWord || q.includes(` ${normalizedWord} `) ||
      q.startsWith(`${normalizedWord} `) || q.endsWith(` ${normalizedWord}`);
  });
}

function createConversationContext() {
  return {
    topic: null,
    category: null,
    menuItem: null,
    day: null,
  };
}

function isGenericMenuListQuestion(text) {
  return containsAny(text, [
    "menu",
    "daftar makanan",
    "daftar minuman",
    "makanan apa",
    "minuman apa",
    "jual apa",
    "jualan apa",
    "tersedia apa",
    "terdapat apa",
  ]);
}

function isPriceQuestion(text, hasMenuItem = false) {
  return (
    containsAny(text, ["harga", "rp", "rupiah", "price"]) ||
    (hasMenuItem && containsAny(text, ["berapa"]))
  );
}

function isAllPricesQuestion(text) {
  return containsAny(text, [
    "daftar harga",
    "harga semua menu",
    "semua harga",
    "menu dan harga",
  ]);
}

function getPriceValue(item) {
  const digits = String(item.harga_online || "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

function formatRupiah(value) {
  return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

function getPriceExtreme(text) {
  if (
    containsAny(text, [
      "paling mahal",
      "termahal",
      "harga tertinggi",
      "harga paling tinggi",
    ])
  ) {
    return "highest";
  }

  if (
    containsAny(text, [
      "paling murah",
      "termurah",
      "harga terendah",
      "harga paling rendah",
    ])
  ) {
    return "lowest";
  }

  return null;
}

function parseMentionedPrice(text) {
  const raw = String(text || "").toLowerCase();
  const shortAmount = raw.match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu|ribuan|k)\b/);

  if (shortAmount) {
    return Math.round(Number(shortAmount[1].replace(",", ".")) * 1000);
  }

  const rupiahAmount = raw.match(/rp\s*([\d.,]+)/);
  if (rupiahAmount) {
    return Number(rupiahAmount[1].replace(/[^\d]/g, ""));
  }

  const formattedAmount = raw.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/);
  if (formattedAmount) {
    return Number(formattedAmount[1].replace(/[^\d]/g, ""));
  }

  const plainAmount = raw.match(/\b(\d{4,6})\b/);
  return plainAmount ? Number(plainAmount[1]) : null;
}

function getPriceFilter(text) {
  const amount = parseMentionedPrice(text);
  if (!amount) return null;

  if (
    containsAny(text, [
      "di atas",
      "diatas",
      "lebih dari",
    ])
  ) {
    return { type: "above", amount };
  }

  if (
    containsAny(text, [
      "minimal",
      "minimum",
      "mulai dari",
    ])
  ) {
    return { type: "minimum", amount };
  }

  if (
    containsAny(text, [
      "di bawah",
      "dibawah",
      "kurang dari",
    ])
  ) {
    return { type: "below", amount };
  }

  if (
    containsAny(text, [
      "maksimal",
      "maksimum",
      "budget",
      "anggaran",
      "punya uang",
      "modal",
      "bawa",
    ])
  ) {
    return { type: "maximum", amount };
  }

  if (containsAny(text, ["harga", "seharga", "sekitar", "kisaran", "ribuan"])) {
    return { type: "exact", amount };
  }

  return null;
}

function getCategoryFilter(text) {
  const categoryRules = [
    {
      label: "minuman hangat",
      terms: ["minuman hangat", "yang hangat"],
      matches: (item) => normalize(item.kategori) === "minuman hangat",
    },
    {
      label: "minuman dingin",
      terms: ["minuman dingin", "yang dingin"],
      matches: (item) => normalize(item.kategori) === "minuman dingin",
    },
    {
      label: "soto",
      terms: ["soto", "sotonya"],
      matches: (item) => normalize(item.nama).startsWith("soto "),
    },
    {
      label: "sate",
      terms: ["sate", "satenya"],
      matches: (item) => normalize(item.nama).startsWith("sate "),
    },
    {
      label: "jus",
      terms: ["jus", "jusnya", "juice"],
      matches: (item) => normalize(item.nama).startsWith("jus "),
    },
    {
      label: "lele",
      terms: ["lele", "lelenya"],
      matches: (item) => containsAny(item.nama, ["lele"]),
    },
    {
      label: "ayam",
      terms: ["ayam", "ayamnya"],
      matches: (item) => containsAny(item.nama, ["ayam"]),
    },
    {
      label: "minuman",
      terms: ["minuman", "minumannya", "drink"],
      matches: (item) => normalize(item.kategori).startsWith("minuman"),
    },
    {
      label: "makanan",
      terms: ["makanan", "makanannya", "makan"],
      matches: (item) => !normalize(item.kategori).startsWith("minuman"),
    },
  ];

  return categoryRules.find((rule) => containsAny(text, rule.terms)) || null;
}

function filterByCategory(menu, category) {
  return category ? menu.filter(category.matches) : menu;
}

function findMentionedDay(text) {
  const days = [
    "senin",
    "selasa",
    "rabu",
    "kamis",
    "jumat",
    "sabtu",
    "minggu",
  ];

  return days.find((day) => containsAny(text, [day]));
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getMeaningfulTokens(text) {
  const ignoredWords = new Set([
    "ada",
    "aja",
    "apa",
    "apakah",
    "dong",
    "kah",
    "kami",
    "saja",
    "terdapat",
    "yang",
  ]);

  return normalize(text)
    .split(" ")
    .filter((word) => word.length > 2 && !ignoredWords.has(word));
}

function matchesFaq(query, faqQuestion) {
  const normalizedQuery = normalize(query);
  const normalizedFaq = normalize(faqQuestion);
  if (!normalizedFaq) return false;
  if (
    normalizedQuery === normalizedFaq ||
    normalizedQuery.includes(normalizedFaq)
  ) {
    return true;
  }

  const faqTokens = getMeaningfulTokens(normalizedFaq);
  const queryTokens = new Set(getMeaningfulTokens(normalizedQuery));
  const matchedTokens = faqTokens.filter((token) => queryTokens.has(token));

  return (
    faqTokens.length > 0 &&
    matchedTokens.length >= Math.ceil(faqTokens.length / 2)
  );
}

function formatMenuList(menu) {
  const groupedMenu = new Map();

  menu.forEach((item) => {
    const category = item.kategori || "Menu lainnya";
    if (!groupedMenu.has(category)) groupedMenu.set(category, []);
    groupedMenu.get(category).push(`- ${item.nama}`);
  });

  const sections = Array.from(groupedMenu, ([category, items]) => {
    return `${category}:\n${items.join("\n")}`;
  });

  return `Menu kami:\n\n${sections.join("\n\n")}`;
}

function formatItemList(items, includePrices = false) {
  return items
    .map((item) => {
      const price = item.harga_online || "Harga tidak tersedia";
      return includePrices ? `- ${item.nama}: ${price}` : `- ${item.nama}`;
    })
    .join("\n");
}

function formatPriceList(menu) {
  const groupedMenu = new Map();

  menu.forEach((item) => {
    const category = item.kategori || "Menu lainnya";
    if (!groupedMenu.has(category)) groupedMenu.set(category, []);
    groupedMenu.get(category).push(
      `- ${item.nama}: ${item.harga_online || "Harga tidak tersedia"}`,
    );
  });

  const sections = Array.from(groupedMenu, ([category, items]) => {
    return `${category}:\n${items.join("\n")}`;
  });

  return `Daftar harga menu:\n\n${sections.join("\n\n")}`;
}

function findMenuItem(query, menu) {
  const normalizedQuery = normalize(query);
  const candidates = menu
    .map((item) => {
    const normalizedName = normalize(item.nama);
      if (!normalizedName) return null;
      if (normalizedQuery.includes(normalizedName)) {
        return { item, score: 1 };
      }

      const nameTokens = getMeaningfulTokens(normalizedName);
      const queryTokens = new Set(getMeaningfulTokens(normalizedQuery));
      const matchedTokens = nameTokens.filter((token) => queryTokens.has(token));
      const score = matchedTokens.length / nameTokens.length;

      if (
        matchedTokens.length === nameTokens.length ||
        (matchedTokens.length >= 3 && score >= 0.7)
      ) {
        return { item, score };
      }

      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return candidates[0] ? candidates[0].item : null;
}

function isCategoryListQuestion(text, category) {
  if (!category) return false;
  return containsAny(text, [
    "apa",
    "apa aja",
    "apa saja",
    "ada",
    "daftar",
    "menu",
    "pilihan",
    "punya",
    "tersedia",
    "jual",
  ]);
}

function isMenuCountQuestion(text) {
  return (
    containsAny(text, [
      "jumlah",
      "total",
      "berapa banyak",
      "ada berapa",
      "berapa macam",
    ]) &&
    containsAny(text, [
      "menu",
      "makanan",
      "minuman",
      "soto",
      "sate",
      "jus",
      "ayam",
      "lele",
    ])
  );
}

function isRecommendationQuestion(text) {
  return containsAny(text, [
    "rekomendasi",
    "andalan",
    "favorit",
    "best seller",
    "bestseller",
    "terlaris",
    "yang enak",
  ]);
}

function isProductScopeQuestion(text) {
  const asksForList = containsAny(text, ["apa saja", "apa aja"]);
  if (asksForList && !containsAny(text, ["selain"])) return false;

  const asksLimitation = containsAny(text, [
    "saja",
    "cuma",
    "cuman",
    "hanya",
    "doang",
    "aja",
  ]);
  const mentionsProduct = containsAny(text, [
    "makanan",
    "minuman",
    "soto",
    "sate",
    "ayam",
    "lele",
    "jus",
  ]);
  const asksAdditionalProducts = containsAny(text, [
    "ada minuman juga",
    "ada makanan juga",
    "selain soto",
    "selain makanan",
    "selain minuman",
    "jual apa lagi",
    "jualan apa lagi",
  ]);

  return (asksLimitation && mentionsProduct) || asksAdditionalProducts;
}

function getProductScopeResponse(text) {
  if (containsAny(text, ["ada minuman juga", "selain makanan"])) {
    return "Ada. Soto Ayam Salimnur juga menjual minuman.";
  }

  if (containsAny(text, ["ada makanan juga", "selain minuman"])) {
    return "Ada. Soto Ayam Salimnur juga menjual makanan.";
  }

  if (containsAny(text, ["soto"])) {
    return "Tidak. Soto Ayam Salimnur juga menjual menu lain dan minuman.";
  }

  if (containsAny(text, ["minuman"])) {
    return "Tidak. Soto Ayam Salimnur juga menjual makanan.";
  }

  return "Tidak. Soto Ayam Salimnur juga menjual minuman.";
}

function isBusinessIntroductionQuestion(text) {
  if (
    containsAny(text, [
      "menu",
      "harga",
      "mahal",
      "murah",
      "termurah",
      "termahal",
      "makanan",
      "minuman",
      "soto",
      "sate",
      "ayam",
      "lele",
      "jus",
      "jam",
      "buka",
      "alamat",
      "lokasi",
      "pemilik",
      "instagram",
      "ig",
    ])
  ) {
    const asksOnlyAboutBusiness =
      containsAny(text, [
        "soto salimnur ini apa",
        "soto salimnur itu apa",
        "soto ayam salimnur ini apa",
        "soto ayam salimnur itu apa",
      ]) &&
      !containsAny(text, ["menu", "harga", "mahal", "murah"]);

    if (!asksOnlyAboutBusiness) return false;
  }

  const mentionsBusiness = containsAny(text, [
    "salimnur",
    "salim nur",
    "soto salimnur",
    "soto ayam salimnur",
    "warung ini",
    "warungnya",
    "tempat ini",
    "di sini",
    "disini",
  ]);
  const asksIdentity = containsAny(text, [
    "apa sih",
    "apa itu",
    "itu apa",
    "ini apa",
    "apaan",
    "tempat apa",
    "warung apa",
    "usaha apa",
    "usahanya apa",
    "jualan apa",
    "jual apa",
    "tentang apa",
    "konsepnya apa",
  ]);

  return (
    (mentionsBusiness && asksIdentity) ||
    containsAny(text, [
      "ini tempat apa",
      "ini restoran apa",
      "restoran atau warung",
      "ini jualan apa",
      "jualan apa",
      "jualan apaan",
      "jual apaan",
      "ada apa di sini",
      "ada apa disini",
      "warungnya jual apa",
    ])
  );
}

function isSubjectiveTasteQuestion(text) {
  return containsAny(text, [
    "enak gak",
    "enak ga",
    "enak tidak",
    "rasanya gimana",
    "worth it",
    "bagus gak",
    "recommended",
    "recommended gak",
    "rekomended",
    "rekomended gak",
    "rekomen gak",
    "layak dicoba",
  ]);
}

function isBusinessHistoryQuestion(text) {
  return containsAny(text, [
    "siapa pemilik",
    "punya siapa",
    "owner",
    "pemiliknya",
    "sejak kapan",
    "berdiri kapan",
    "tahun berapa",
    "kenapa namanya",
    "asal nama",
    "sejarah",
  ]);
}

function isRecipeQuestion(text) {
  return containsAny(text, [
    "bahan",
    "bahannya",
    "isi soto",
    "isinya apa",
    "apa isinya",
    "apa aja isinya",
    "isinya",
    "kuah",
    "kuahnya",
    "resep",
    "kalori",
    "kalorinya",
    "alergi",
    "alergen",
    "pakai santan",
  ]);
}

function isDistanceQuestion(text) {
  return containsAny(text, [
    "jauh gak",
    "jauh ga",
    "berapa jauh",
    "berapa lama perjalanan",
    "berapa menit",
    "waktu tempuh",
    "dekat gak",
    "dekat ga",
  ]);
}

function isBulkOrderQuestion(text) {
  return containsAny(text, [
    "pesanan banyak",
    "pesan banyak",
    "partai besar",
    "catering",
    "katering",
    "buat acara",
    "untuk acara",
    "hajatan",
    "rombongan",
  ]);
}

function isUnlistedProductQuestion(text) {
  const asksAvailability = containsAny(text, [
    "ada",
    "punya",
    "jual",
    "jualan",
    "tersedia",
  ]);
  const unlistedProducts = [
    "bakso",
    "bebek",
    "burger",
    "gado gado",
    "kopi",
    "martabak",
    "mie",
    "nasi goreng",
    "pizza",
    "rendang",
    "seafood",
    "seblak",
  ];

  return (
    asksAvailability &&
    unlistedProducts.find((product) => containsAny(text, [product]))
  );
}

function getUnexpectedQuestionResponse(text, info, menu, matchedMenu) {
  const asksInstagram = containsAny(text, [
    "instagram",
    "instagramnya",
    "ig",
    "ignya",
    "akun ig",
    "sosial media",
    "media sosial",
  ]);

  if (isSubjectiveTasteQuestion(text)) {
    if (matchedMenu) {
      return `Soal rasa tergantung selera. ${matchedMenu.nama} tercantum di menu dengan harga online ${matchedMenu.harga_online || "yang belum tersedia"}.`;
    }

    const featuredNames = Array.isArray(info.menu_andalan)
      ? info.menu_andalan
      : [];
    const featuredPrices = menu
      .filter((item) => featuredNames.includes(item.nama))
      .map(getPriceValue)
      .filter((price) => price !== null);
    const priceNote = featuredPrices.length > 0
      ? ` Harga online menu andalan mulai ${formatRupiah(Math.min(...featuredPrices))}.`
      : "";

    return `Soal rasa tergantung selera. Menu andalan yang bisa dicoba adalah ${featuredNames.join(", ") || "soto ayam"}.${priceNote}`;
  }

  if (
    containsAny(text, [
      "google maps",
      "maps",
      "mapsnya",
      "rute",
      "rutenya",
      "petunjuk arah",
      "cara ke sana",
      "cara kesana",
    ])
  ) {
    return info.maps_url
      ? `Petunjuk arah ke warung: ${info.maps_url}`
      : `Alamat warung: ${info.alamat || "belum tersedia"}.`;
  }

  if (
    containsAny(text, [
      "cocok buat sarapan",
      "buat sarapan",
      "untuk sarapan",
      "cocok buat makan siang",
      "buat makan siang",
      "untuk makan siang",
    ])
  ) {
    return `Bisa menjadi pilihan karena warung buka pukul ${info.jam_buka || "07:30 - 17:00"} dan menyediakan soto ayam serta menu makanan lainnya.`;
  }

  if (
    !asksInstagram &&
    containsAny(text, [
      "siapa pemilik",
      "punya siapa",
      "owner",
      "pemiliknya",
      "yang punya",
    ])
  ) {
    return `Pemilik ${info.nama || "Soto Ayam Salimnur"} adalah ${
      info.pemilik || "belum tercatat"
    }.`;
  }

  if (asksInstagram) {
    if (
      !containsAny(text, [
        "pemilik",
        "pemiliknya",
        "owner",
        "reza",
        "reza putra fadilah",
        "yang punya",
      ])
    ) {
      return info.instagram_warung
        ? `Instagram resmi ${info.nama || "Soto Ayam Salimnur"}: ${info.instagram_warung}`
        : `Untuk saat ini, ${info.nama || "Soto Ayam Salimnur"} belum memiliki akun Instagram resmi.`;
    }

    return `Instagram pemilik: ${
      info.instagram_pemilik || "belum tersedia"
    }${info.instagram_url ? ` (${info.instagram_url})` : ""}`;
  }

  if (isBusinessHistoryQuestion(text)) {
    return "Informasi sejarah dan asal nama Salimnur belum tersedia di data chatbot.";
  }

  if (
    containsAny(text, [
      "apa bedanya",
      "beda apa",
      "bedanya apa",
      "ciri khas",
      "ciri khasnya",
      "keunikannya",
      "spesialnya apa",
      "yang bikin beda",
    ])
  ) {
    return "Menu utama Soto Ayam Salimnur adalah soto ayam dengan pilihan telur atau ceker. Detail perbedaan resep dan ciri khas dibanding soto lain belum tersedia.";
  }

  if (isRecipeQuestion(text)) {
    return "Informasi resep, bahan lengkap, kandungan alergi, dan kalori belum tersedia. Silakan konfirmasi langsung ke warung sebelum memesan.";
  }

  if (
    containsAny(text, [
      "ramai gak",
      "ramai ga",
      "lagi ramai",
      "antre",
      "antri",
      "sepi",
    ])
  ) {
    return "Chatbot tidak dapat melihat kondisi keramaian secara langsung. Silakan hubungi warung untuk kondisi terbaru.";
  }

  if (isDistanceQuestion(text)) {
    return `Jarak dan waktu tempuh bergantung pada lokasi keberangkatan Anda. Alamat warung: ${info.alamat || "Pondok Ungu Permai, Bekasi, Jawa Barat"}.`;
  }

  if (isBulkOrderQuestion(text)) {
    return `Untuk pesanan acara atau jumlah banyak, silakan konfirmasi melalui WhatsApp di ${info.kontak || "kontak warung"}.`;
  }

  if (
    containsAny(text, [
      "ada cabang",
      "punya cabang",
      "cabang lain",
      "berapa cabang",
    ])
  ) {
    return "Informasi cabang lain belum tersedia. Lokasi yang tercatat berada di Pondok Ungu Permai, Bekasi.";
  }

  if (
    containsAny(text, [
      "makan di tempat",
      "dine in",
      "bungkus",
      "takeaway",
      "take away",
    ])
  ) {
    return "Anda bisa datang langsung ke warung. Untuk memastikan layanan makan di tempat atau bungkus, silakan konfirmasi ke warung.";
  }

  if (
    containsAny(text, [
      "ongkir",
      "ongkirnya",
      "biaya antar",
      "jarak antar",
      "radius antar",
      "sampai rumah",
    ])
  ) {
    return "Biaya dan jangkauan pengantaran mengikuti GoFood atau GrabFood sesuai alamat tujuan.";
  }

  const unlistedProduct = isUnlistedProductQuestion(text);
  if (unlistedProduct) {
    return `${capitalize(unlistedProduct)} tidak tercantum di daftar menu saat ini.`;
  }

  if (containsAny(text, ["halal", "sertifikat halal"])) {
    return "Informasi sertifikasi halal belum tersedia di data chatbot. Silakan konfirmasi langsung ke warung.";
  }

  if (
    containsAny(text, [
      "pembayaran",
      "bayar",
      "qris",
      "tunai",
      "cash",
      "transfer",
      "debit",
    ])
  ) {
    return "Informasi metode pembayaran belum tersedia di data chatbot. Silakan konfirmasi langsung ke warung.";
  }

  if (
    containsAny(text, [
      "parkir",
      "toilet",
      "wifi",
      "fasilitas",
      "reservasi",
      "booking",
      "ramah anak",
      "anak anak",
    ])
  ) {
    return "Informasi fasilitas atau reservasi belum tersedia di data chatbot. Silakan hubungi warung untuk memastikannya.";
  }

  if (
    containsAny(text, [
      "pedas",
      "sambal",
      "topping",
      "tambahan",
      "porsi",
      "request",
      "custom",
    ])
  ) {
    return "Informasi pilihan sambal, tambahan, dan porsi belum tersedia. Silakan tanyakan langsung saat memesan.";
  }

  if (
    containsAny(text, [
      "kamu siapa",
      "ini bot",
      "chatbot apa",
      "manusia atau bot",
    ])
  ) {
    return "Saya chatbot Warung Soto Ayam Salimnur. Saya membantu menjawab pertanyaan berdasarkan data menu dan informasi warung.";
  }

  return null;
}

function getRelativeDaySchedule(info, dayOffset, now = new Date()) {
  const targetDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: info.zona_waktu || "Asia/Jakarta",
    weekday: "long",
  }).format(targetDate);
  const dayMap = {
    Monday: "senin",
    Tuesday: "selasa",
    Wednesday: "rabu",
    Thursday: "kamis",
    Friday: "jumat",
    Saturday: "sabtu",
    Sunday: "minggu",
  };
  const day = dayMap[weekday];

  return {
    day,
    schedule: info.jadwal && info.jadwal[day],
  };
}

function getCurrentOpenStatus(info, now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: info.zona_waktu || "Asia/Jakarta",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  const dayMap = {
    Monday: "senin",
    Tuesday: "selasa",
    Wednesday: "rabu",
    Thursday: "kamis",
    Friday: "jumat",
    Saturday: "sabtu",
    Sunday: "minggu",
  };
  const day = dayMap[parts.weekday];
  const schedule = info.jadwal && info.jadwal[day];

  if (!schedule || normalize(schedule) === "libur") {
    return { isOpen: false, day, schedule: schedule || "Jadwal tidak tersedia" };
  }

  const timeRange = schedule.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
  if (!timeRange) return { isOpen: false, day, schedule };

  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const openingMinutes = Number(timeRange[1]) * 60 + Number(timeRange[2]);
  const closingMinutes = Number(timeRange[3]) * 60 + Number(timeRange[4]);

  return {
    isOpen:
      currentMinutes >= openingMinutes && currentMinutes < closingMinutes,
    day,
    schedule,
  };
}

function getStandaloneBotResponse(message, model) {
  if (!model) {
    return "Data chatbot sedang dimuat. Silakan coba lagi sebentar.";
  }

  const q = normalize(message);
  const menu = Array.isArray(model.menu) ? model.menu : [];
  const info = model.info || {};
  const category = getCategoryFilter(q);
  const scopedMenu = filterByCategory(menu, category);
  const matchedMenu = findMenuItem(q, menu);
  const mentionedDay = findMentionedDay(q);
  const priceExtreme = getPriceExtreme(q);
  const priceFilter = getPriceFilter(message);

  if (isProductScopeQuestion(q)) {
    return getProductScopeResponse(q);
  }

  const unexpectedResponse = getUnexpectedQuestionResponse(
    q,
    info,
    menu,
    matchedMenu,
  );
  if (unexpectedResponse) {
    return unexpectedResponse;
  }

  if (isBusinessIntroductionQuestion(q)) {
    return info.deskripsi ||
      `${info.nama || "Soto Ayam Salimnur"} adalah warung makan yang menyediakan soto ayam, lauk, dan minuman.`;
  }

  if (
    containsAny(q, [
      "buka sekarang",
      "masih buka",
      "sudah buka",
      "sekarang buka",
    ])
  ) {
    const status = getCurrentOpenStatus(info);
    const dayLabel = status.day ? capitalize(status.day) : "hari ini";

    if (status.isOpen) {
      return `Ya, saat ini warung buka. Jadwal hari ${dayLabel}: ${status.schedule}.`;
    }
    if (normalize(status.schedule) === "libur") {
      return `Saat ini warung tutup karena hari ${dayLabel} libur.`;
    }
    return `Saat ini warung tutup. Jadwal hari ${dayLabel}: ${status.schedule}.`;
  }

  if (
    containsAny(q, ["hari ini", "besok", "lusa"]) &&
    containsAny(q, ["buka", "tutup", "libur", "operasional"])
  ) {
    const dayOffset = containsAny(q, ["lusa"])
      ? 2
      : containsAny(q, ["besok"])
        ? 1
        : 0;
    const relativeLabel = dayOffset === 0 ? "Hari ini" : dayOffset === 1
      ? "Besok"
      : "Lusa";
    const status = getRelativeDaySchedule(info, dayOffset);
    const dayLabel = status.day ? capitalize(status.day) : "";

    if (!status.schedule) {
      return `Jadwal ${relativeLabel.toLowerCase()} belum tersedia.`;
    }
    if (normalize(status.schedule) === "libur") {
      return `${relativeLabel} (${dayLabel}) warung libur.`;
    }
    return `${relativeLabel} (${dayLabel}) warung buka pukul ${status.schedule}.`;
  }

  if (
    mentionedDay &&
    containsAny(q, ["buka", "tutup", "libur", "operasional", "jam"])
  ) {
    const schedule = info.jadwal && info.jadwal[mentionedDay];
    const dayLabel = capitalize(mentionedDay);

    if (!schedule) {
      return `Jadwal hari ${dayLabel} belum tersedia.`;
    }
    if (normalize(schedule) === "libur") {
      return `Tidak, hari ${dayLabel} warung libur.`;
    }
    if (containsAny(q, ["jam", "pukul"])) {
      return `Jam buka hari ${dayLabel}: ${schedule}.`;
    }
    return `Ya, warung buka hari ${dayLabel}.`;
  }

  if (
    containsAny(q, ["hari", "kapan"]) &&
    containsAny(q, ["buka", "operasional"])
  ) {
    return `Hari buka: ${info.hari_buka || "Tidak tersedia"}. ${
      info.hari_libur ? `Hari ${info.hari_libur} libur.` : ""
    }`.trim();
  }

  if (containsAny(q, ["jam", "pukul"])) {
    return `Jam buka: ${info.jam_buka || "Tidak tersedia"}.`;
  }
  if (containsAny(q, ["buka", "bukaan", "tutup", "operasional", "open"])) {
    return `Hari buka: ${info.hari_buka || "Tidak tersedia"}.`;
  }

  if (priceExtreme && scopedMenu.length > 0) {
    const pricedItems = scopedMenu.filter((item) => getPriceValue(item) !== null);
    const prices = pricedItems.map(getPriceValue);
    const targetPrice =
      priceExtreme === "highest" ? Math.max(...prices) : Math.min(...prices);
    const matchingItems = pricedItems.filter(
      (item) => getPriceValue(item) === targetPrice,
    );
    const itemNames = matchingItems.map((item) => item.nama).join(" dan ");
    const scopeLabel = category ? capitalize(category.label) : "Menu";
    const priceLabel = priceExtreme === "highest" ? "paling mahal" : "paling murah";

    return `${scopeLabel} ${priceLabel} adalah ${itemNames} dengan harga online ${formatRupiah(targetPrice)}.`;
  }

  if (priceFilter) {
    const matchingItems = scopedMenu
      .filter((item) => {
        const price = getPriceValue(item);
        if (price === null) return false;
        if (priceFilter.type === "below") return price < priceFilter.amount;
        if (priceFilter.type === "maximum") return price <= priceFilter.amount;
        if (priceFilter.type === "above") return price > priceFilter.amount;
        if (priceFilter.type === "minimum") return price >= priceFilter.amount;
        return price === priceFilter.amount;
      })
      .sort((a, b) => getPriceValue(a) - getPriceValue(b));

    if (matchingItems.length === 0) {
      return `Tidak ada ${category ? category.label : "menu"} yang cocok dengan batas harga ${formatRupiah(priceFilter.amount)}.`;
    }

    const relationLabels = {
      below: "di bawah",
      maximum: "maksimal",
      above: "di atas",
      minimum: "minimal",
      exact: "seharga",
    };
    return `Pilihan ${category ? category.label : "menu"} dengan harga online ${relationLabels[priceFilter.type]} ${formatRupiah(priceFilter.amount)}:\n${formatItemList(matchingItems, true)}`;
  }

  if (isMenuCountQuestion(q)) {
    const label = category ? category.label : "menu";
    return `Ada ${scopedMenu.length} pilihan ${label} di daftar kami.`;
  }

  if (isRecommendationQuestion(q)) {
    if (category && scopedMenu.length > 0) {
      return `Pilihan ${category.label} yang tersedia:\n${formatItemList(scopedMenu)}`;
    }

    const featuredItems = Array.isArray(info.menu_andalan)
      ? info.menu_andalan
      : [];
    if (featuredItems.length > 0) {
      return `Menu andalan kami:\n${featuredItems.map((item) => `- ${item}`).join("\n")}`;
    }
    return info.keterangan || "Informasi menu andalan belum tersedia.";
  }

  if (
    containsAny(q, [
      "harga offline",
      "harga langsung",
      "harga di tempat",
      "harga di warung",
      "harga kalau beli langsung",
      "harga beli langsung",
      "harga datang langsung",
    ])
  ) {
    return "Untuk harga offline, silakan datang dan membeli langsung atau tanyakan kepada penjual di warung. Harga yang tercantum di chatbot adalah harga online.";
  }

  if (isAllPricesQuestion(q)) {
    return formatPriceList(menu);
  }

  if (matchedMenu) {
    if (isPriceQuestion(q, true)) {
      return `Harga online ${matchedMenu.nama}: ${
        matchedMenu.harga_online || "tidak tersedia"
      }.`;
    }
    if (
      containsAny(q, [
        "stok",
        "habis",
        "ready",
        "masih ada",
        "tersedia sekarang",
      ])
    ) {
      return `${matchedMenu.nama} tercantum di menu, tetapi stok saat ini perlu dikonfirmasi langsung ke warung.`;
    }
    return `${matchedMenu.nama} tersedia di daftar menu kami.`;
  }

  if (
    containsAny(q, [
      "stok",
      "habis",
      "ready",
      "masih tersedia",
      "masih ada",
    ])
  ) {
    return "Chatbot tidak dapat melihat stok secara langsung. Silakan sebutkan nama menu atau hubungi warung untuk memastikan ketersediaannya.";
  }

  if (category && isCategoryListQuestion(q, category)) {
    if (scopedMenu.length === 0) {
      return `Belum ada ${category.label} di daftar menu kami.`;
    }
    if (isPriceQuestion(q)) {
      return `Daftar harga online ${category.label}:\n${formatItemList(scopedMenu, true)}`;
    }
    return `Pilihan ${category.label}:\n${formatItemList(scopedMenu)}`;
  }

  if (isPriceQuestion(q)) {
    return "Silakan sebutkan nama menu, kategori, atau batas harga yang ingin dicari.";
  }

  if (menu.length > 0 && isGenericMenuListQuestion(q)) {
    return formatMenuList(menu);
  }

  if (
    containsAny(q, [
      "alamat",
      "alamatnya",
      "di mana",
      "dimana",
      "lokasi",
      "lokasinya",
      "where",
    ])
  ) {
    return `Alamat: ${info.alamat || "Tidak tersedia"}.`;
  }

  if (
    containsAny(q, [
      "layanan antar",
      "pesan online",
      "order online",
      "delivery",
      "gofood",
      "grabfood",
      "cara pesan",
      "pesan lewat",
      "pesan gimana",
      "pesannya",
      "cara order",
      "ordernya",
      "bisa diantar",
    ])
  ) {
    return info.layanan_pesan ||
      "Pemesanan tersedia melalui GoFood, GrabFood, atau datang langsung.";
  }

  if (
    containsAny(q, [
      "kontak",
      "telepon",
      "nomor",
      "nomornya",
      "nomor hp",
      "no hp",
      "wa",
      "whatsapp",
      "contact",
    ])
  ) {
    return `Kontak: ${info.kontak || "Tidak tersedia"}.`;
  }

  if (containsAny(q, ["promo", "diskon", "potongan", "paket hemat"])) {
    return info.promo ||
      "Informasi promo saat ini belum tersedia. Silakan konfirmasi langsung ke warung.";
  }

  if (
    containsAny(q, [
      "nama warung",
      "warung apa",
      "ini warung apa",
      "siapa nama",
    ])
  ) {
    return `Nama warung ini adalah ${info.nama || "Soto Ayam Salimnur"}.`;
  }

  if (
    containsAny(q, [
      "bisa tanya apa",
      "dapat tanya apa",
      "contoh pertanyaan",
      "bantuan",
      "help",
    ])
  ) {
    return [
      "Anda bisa bertanya seperti:",
      "- Menu apa saja yang tersedia?",
      "- Apa menu paling mahal atau paling murah?",
      "- Ada menu di bawah Rp 10.000?",
      "- Berapa harga Soto Ayam Telur Full?",
      "- Ada pilihan jus atau minuman hangat?",
      "- Hari apa warung buka?",
      "- Apakah sekarang masih buka?",
      "- Di mana lokasi warung?",
      "- Bagaimana cara memesan?",
      "- Soto Salimnur ini apa sih?",
      "- Bisa pesan banyak untuk acara?",
    ].join("\n");
  }

  if (containsAny(q, ["keterangan", "tentang", "info", "about"])) {
    return info.keterangan || "Informasi tidak tersedia";
  }

  if (
    containsAny(q, [
      "terima kasih",
      "makasih",
      "thanks",
      "thank you",
    ])
  ) {
    return "Sama-sama. Silakan tanyakan menu atau informasi warung lainnya.";
  }

  if (
    containsAny(q, [
      "halo",
      "hai",
      "hello",
      "assalamualaikum",
      "selamat pagi",
      "selamat siang",
      "selamat sore",
      "selamat malam",
    ])
  ) {
    return "Halo! Anda bisa bertanya tentang menu, harga, rekomendasi, jam buka, lokasi, atau cara memesan.";
  }

  return "Maaf, saya belum memahami pertanyaan itu. Coba tanyakan nama menu, harga termurah atau termahal, pilihan berdasarkan budget, jam buka, lokasi, atau cara memesan.";
}

function getExtremePriceResponse(menu, category, extreme) {
  const scopedMenu = filterByCategory(menu, category);
  const pricedItems = scopedMenu.filter((item) => getPriceValue(item) !== null);
  if (pricedItems.length === 0) return null;

  const prices = pricedItems.map(getPriceValue);
  const targetPrice = extreme === "highest"
    ? Math.max(...prices)
    : Math.min(...prices);
  const itemNames = pricedItems
    .filter((item) => getPriceValue(item) === targetPrice)
    .map((item) => item.nama)
    .join(" dan ");
  const scopeLabel = category ? capitalize(category.label) : "Menu";
  const priceLabel = extreme === "highest" ? "paling mahal" : "paling murah";

  return `${scopeLabel} ${priceLabel} adalah ${itemNames} dengan harga online ${formatRupiah(targetPrice)}.`;
}

function getContextualPriceFilterResponse(text, menu, category) {
  const priceFilter = getPriceFilter(text);
  if (!priceFilter || !category) return null;

  const matchingItems = filterByCategory(menu, category)
    .filter((item) => {
      const price = getPriceValue(item);
      if (price === null) return false;
      if (priceFilter.type === "below") return price < priceFilter.amount;
      if (priceFilter.type === "maximum") return price <= priceFilter.amount;
      if (priceFilter.type === "above") return price > priceFilter.amount;
      if (priceFilter.type === "minimum") return price >= priceFilter.amount;
      return price === priceFilter.amount;
    })
    .sort((a, b) => getPriceValue(a) - getPriceValue(b));

  if (matchingItems.length === 0) {
    return `Tidak ada ${category.label} yang cocok dengan batas harga ${formatRupiah(priceFilter.amount)}.`;
  }

  const relationLabels = {
    below: "di bawah",
    maximum: "maksimal",
    above: "di atas",
    minimum: "minimal",
    exact: "seharga",
  };

  return `Pilihan ${category.label} dengan harga online ${relationLabels[priceFilter.type]} ${formatRupiah(priceFilter.amount)}:\n${formatItemList(matchingItems, true)}`;
}

function getFollowUpResponse(message, model, context) {
  const q = normalize(message);

  if (containsAny(q, ["reset chat", "mulai lagi", "ganti topik"])) {
    Object.assign(context, createConversationContext());
    return "Baik, silakan mulai dengan pertanyaan baru.";
  }

  if (!context || !context.topic) return null;

  const menu = Array.isArray(model.menu) ? model.menu : [];
  const info = model.info || {};
  const category = context.category
    ? getCategoryFilter(context.category)
    : null;
  const menuItem = context.menuItem
    ? menu.find((item) => item.nama === context.menuItem)
    : null;
  const explicitMenuItem = findMenuItem(q, menu);
  const explicitCategory = getCategoryFilter(q);
  const switchesCategory = containsAny(q, [
    "yang hangat",
    "yang dingin",
    "kalau jus",
    "kalau soto",
    "kalau sate",
    "kalau makanan",
    "kalau minuman",
    "kalau ayam",
    "kalau lele",
    "makanannya",
    "minumannya",
    "sotonya",
    "satenya",
    "jusnya",
  ]);

  if (
    explicitMenuItem &&
    (!menuItem || explicitMenuItem.nama !== menuItem.nama)
  ) {
    return null;
  }
  if (
    explicitCategory &&
    (!category || explicitCategory.label !== category.label) &&
    !switchesCategory
  ) {
    return null;
  }
  if (
    category &&
    containsAny(q, ["menu"]) &&
    getPriceExtreme(q)
  ) {
    return null;
  }

  if (
    context.topic === "owner" &&
    containsAny(q, ["ig", "ignya", "instagram", "instagramnya"]) &&
    !containsAny(q, ["warung", "salimnur", "resmi"])
  ) {
    return `Instagram pemilik: ${
      info.instagram_pemilik || "belum tersedia"
    }${info.instagram_url ? ` (${info.instagram_url})` : ""}`;
  }

  if (
    context.topic === "social" &&
    containsAny(q, ["pemilik", "owner", "reza", "yang punya"])
  ) {
    return `Instagram pemilik: ${
      info.instagram_pemilik || "belum tersedia"
    }${info.instagram_url ? ` (${info.instagram_url})` : ""}`;
  }

  if (
    context.topic === "schedule" &&
    context.day &&
    containsAny(q, ["jam berapa", "pukul berapa", "jamnya"])
  ) {
    const schedule = info.jadwal && info.jadwal[context.day];
    const dayLabel = capitalize(context.day);
    return normalize(schedule) === "libur"
      ? `Hari ${dayLabel} warung libur.`
      : `Jam buka hari ${dayLabel}: ${schedule || "belum tersedia"}.`;
  }

  if (
    context.topic === "schedule" &&
    containsAny(q, ["hari apa", "hari apa aja", "hari apa saja"])
  ) {
    return `Hari buka: ${info.hari_buka || "Tidak tersedia"}. ${
      info.hari_libur ? `Hari ${info.hari_libur} libur.` : ""
    }`.trim();
  }

  if (
    context.topic === "order" &&
    containsAny(q, ["lewat apa", "pesannya gimana", "caranya", "gimana"])
  ) {
    return info.layanan_pesan ||
      "Pemesanan tersedia melalui GoFood, GrabFood, WhatsApp, atau datang langsung.";
  }

  if (
    context.topic === "promo" &&
    containsAny(q, ["kapan", "hari apa", "harinya", "berlaku kapan"])
  ) {
    return info.promo_hari
      ? `Promo Jumat Berkah tersedia pada hari ${info.promo_hari}.`
      : "Jadwal promo belum tersedia. Silakan konfirmasi langsung ke warung.";
  }

  if (
    menuItem &&
    containsAny(q, [
      "berapa",
      "berapa harganya",
      "harganya",
      "harga berapa",
      "itu berapa",
    ])
  ) {
    return `Harga online ${menuItem.nama}: ${
      menuItem.harga_online || "tidak tersedia"
    }.`;
  }

  if (
    menuItem &&
    containsAny(q, ["yang lain", "lainnya", "menu sejenis"])
  ) {
    const itemCategory = menuItem.kategori
      ? getCategoryFilter(menuItem.kategori)
      : null;
    const alternatives = filterByCategory(menu, itemCategory).filter(
      (item) => item.nama !== menuItem.nama,
    );
    return alternatives.length > 0
      ? `Pilihan lain:\n${formatItemList(alternatives)}`
      : "Belum ada pilihan lain dalam kategori yang sama.";
  }

  if (
    menuItem &&
    containsAny(q, ["stoknya", "masih ada", "ready", "habis"])
  ) {
    return `${menuItem.nama} tercantum di menu, tetapi stok saat ini perlu dikonfirmasi langsung ke warung.`;
  }

  if (
    category &&
    containsAny(q, [
      "berapa harganya",
      "harganya",
      "daftar harganya",
      "harga berapa",
    ])
  ) {
    return `Daftar harga online ${category.label}:\n${formatItemList(
      filterByCategory(menu, category),
      true,
    )}`;
  }

  if (
    category &&
    containsAny(q, ["ada berapa", "berapa banyak", "jumlahnya"])
  ) {
    return `Ada ${filterByCategory(menu, category).length} pilihan ${category.label}.`;
  }

  const contextualPriceResponse = getContextualPriceFilterResponse(
    message,
    menu,
    category,
  );
  if (contextualPriceResponse) return contextualPriceResponse;

  let extreme = getPriceExtreme(q);
  if (!extreme && containsAny(q, ["yang murah", "lebih murah"])) {
    extreme = "lowest";
  }
  if (!extreme && containsAny(q, ["yang mahal", "lebih mahal"])) {
    extreme = "highest";
  }
  if (extreme && (category || context.topic === "menu")) {
    return getExtremePriceResponse(menu, category, extreme);
  }

  const followUpCategory = explicitCategory;
  if (
    followUpCategory &&
    containsAny(q, [
      "yang hangat",
      "yang dingin",
      "kalau jus",
      "kalau soto",
      "kalau sate",
      "kalau makanan",
      "kalau minuman",
      "kalau ayam",
      "kalau lele",
      "makanannya",
      "minumannya",
      "sotonya",
      "satenya",
      "jusnya",
    ])
  ) {
    context.topic = "category";
    context.category = followUpCategory.label;
    context.menuItem = null;
    return `Pilihan ${followUpCategory.label}:\n${formatItemList(
      filterByCategory(menu, followUpCategory),
    )}`;
  }

  if (
    containsAny(q, [
      "apa aja",
      "apa saja",
      "ada apa aja",
      "ada apa saja",
      "pilihannya apa",
      "terus apa aja",
      "terus apa saja",
    ])
  ) {
    if (category) {
      return `Pilihan ${category.label}:\n${formatItemList(
        filterByCategory(menu, category),
      )}`;
    }
    if (context.topic === "menu") return formatMenuList(menu);
  }

  return null;
}

function updateConversationContext(message, model, context) {
  const q = normalize(message);
  const menu = Array.isArray(model.menu) ? model.menu : [];
  const category = getCategoryFilter(q);
  const matchedMenu = findMenuItem(q, menu);
  const mentionedDay = findMentionedDay(q);

  if (isProductScopeQuestion(q)) {
    context.topic = "category";
    context.menuItem = null;
    if (
      containsAny(q, [
        "ada minuman juga",
        "selain makanan",
        "makanan saja",
        "cuma makanan",
        "hanya makanan",
      ])
    ) {
      context.category = "minuman";
    } else if (
      containsAny(q, [
        "ada makanan juga",
        "selain minuman",
        "minuman saja",
        "cuma minuman",
        "hanya minuman",
      ])
    ) {
      context.category = "makanan";
    } else {
      context.topic = "menu";
      context.category = null;
    }
    return;
  }

  if (
    containsAny(q, [
      "instagram",
      "instagramnya",
      "ig",
      "ignya",
      "akun ig",
      "media sosial",
      "sosial media",
    ])
  ) {
    context.topic = containsAny(q, [
      "pemilik",
      "pemiliknya",
      "owner",
      "reza",
      "yang punya",
    ])
      ? "owner"
      : "social";
    context.category = null;
    context.menuItem = null;
    return;
  }

  if (
    containsAny(q, [
      "siapa pemilik",
      "pemiliknya",
      "owner",
      "yang punya",
    ])
  ) {
    context.topic = "owner";
    context.category = null;
    context.menuItem = null;
    return;
  }

  if (
    containsAny(q, [
      "alamat",
      "alamatnya",
      "lokasi",
      "lokasinya",
      "maps",
      "rute",
      "petunjuk arah",
    ])
  ) {
    context.topic = "location";
    context.category = null;
    context.menuItem = null;
    return;
  }

  if (containsAny(q, ["promo", "diskon", "potongan", "jumat berkah"])) {
    context.topic = "promo";
    context.category = null;
    context.menuItem = null;
    return;
  }

  if (
    containsAny(q, [
      "cara pesan",
      "pesan online",
      "order online",
      "gofood",
      "grabfood",
      "delivery",
    ])
  ) {
    context.topic = "order";
    context.category = null;
    context.menuItem = null;
    return;
  }

  if (mentionedDay) {
    context.topic = "schedule";
    context.day = mentionedDay;
    context.category = null;
    context.menuItem = null;
    return;
  }

  if (
    containsAny(q, ["jam buka", "hari buka", "operasional", "buka hari"])
  ) {
    context.topic = "schedule";
    context.day = null;
    context.category = null;
    context.menuItem = null;
    return;
  }

  if (matchedMenu) {
    context.topic = "item";
    context.menuItem = matchedMenu.nama;
    context.category = matchedMenu.kategori || null;
    return;
  }

  let extreme = getPriceExtreme(q);
  if (!extreme && containsAny(q, ["yang murah", "lebih murah"])) {
    extreme = "lowest";
  }
  if (!extreme && containsAny(q, ["yang mahal", "lebih mahal"])) {
    extreme = "highest";
  }
  if (extreme) {
    const activeCategory = category ||
      (context.category ? getCategoryFilter(context.category) : null);
    const scopedMenu = filterByCategory(menu, activeCategory);
    const pricedItems = scopedMenu.filter(
      (item) => getPriceValue(item) !== null,
    );
    if (pricedItems.length > 0) {
      const prices = pricedItems.map(getPriceValue);
      const targetPrice = extreme === "highest"
        ? Math.max(...prices)
        : Math.min(...prices);
      const targetItem = pricedItems.find(
        (item) => getPriceValue(item) === targetPrice,
      );
      context.topic = "item";
      context.menuItem = targetItem ? targetItem.nama : null;
      context.category = activeCategory ? activeCategory.label : null;
      return;
    }
  }

  if (category) {
    context.topic = "category";
    context.category = category.label;
    context.menuItem = null;
    return;
  }

  if (isGenericMenuListQuestion(q)) {
    context.topic = "menu";
    context.category = null;
    context.menuItem = null;
  }
}

function getBotResponse(message, model, context = CHAT_CONTEXT) {
  if (!model) {
    return "Data chatbot sedang dimuat. Silakan coba lagi sebentar.";
  }

  const followUpResponse = getFollowUpResponse(message, model, context);
  if (followUpResponse) {
    updateConversationContext(message, model, context);
    return followUpResponse;
  }

  const response = getStandaloneBotResponse(message, model);
  updateConversationContext(message, model, context);
  return response;
}

async function sendUserMessage(presetMessage) {
  if (!chatbotInput) return;
  const message = typeof presetMessage === "string"
    ? presetMessage.trim()
    : chatbotInput.value.trim();
  if (!message) return;
  appendMessage("user", message);
  chatbotInput.value = "";
  setLoading(true);

  try {
    appendMessage("bot", getBotResponse(message, MODEL_CONTEXT));
  } catch (err) {
    console.error("Local chatbot error", err);
    appendMessage("bot", "Terjadi kesalahan internal pada chat lokal.");
  } finally {
    setLoading(false);
  }
}

// event listeners
if (chatbotToggle && chatbotPanel)
  chatbotToggle.addEventListener("click", () => {
    if (chatbotPanel.classList.contains("chatbot-open")) closeChatbot();
    else openChatbot();
  });
if (chatbotClose) chatbotClose.addEventListener("click", closeChatbot);
if (chatbotSend) chatbotSend.addEventListener("click", sendUserMessage);
if (chatbotReset) {
  chatbotReset.addEventListener("click", () => {
    CHAT_CONTEXT = createConversationContext();
    if (chatbotMessages) {
      chatbotMessages.innerHTML = "";
      appendMessage(
        "bot",
        "Percakapan baru dimulai. Mau tanya menu, harga, jam buka, atau cara pesan?",
      );
    }
    if (chatbotInput) chatbotInput.focus();
  });
}
if (chatbotSuggestions) {
  chatbotSuggestions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chat-message]");
    if (!button) return;
    sendUserMessage(button.dataset.chatMessage || "");
  });
}
if (chatbotInput)
  chatbotInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendUserMessage();
    }
  });
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    chatbotPanel &&
    chatbotPanel.classList.contains("chatbot-open")
  ) {
    closeChatbot();
    if (chatbotToggle) chatbotToggle.focus();
  }
});

// Keep API key UI inert: do not use key in this local-only mode, but allow user to store it if desired
if (chatbotSaveKey && chatbotApiKeyInput) {
  chatbotSaveKey.addEventListener("click", () => {
    const k = chatbotApiKeyInput.value.trim();
    if (!k) return;
    try {
      localStorage.setItem("GEMINI_API_KEY", k);
    } catch (e) {
      console.warn("Could not save API key to localStorage", e);
    }
    chatbotApiKeyInput.value = "";
    appendMessage(
      "bot",
      "API key disimpan di browser (tidak digunakan dalam mode lokal).",
    );
  });
}
