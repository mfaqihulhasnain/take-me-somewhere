export const CATEGORIES = [
  { slug: "weird-web", label: "Weird web", description: "The internet's stranger corners.", accent: "#ff6b6b" },
  { slug: "useless-tools", label: "Useless tools", description: "Tiny machines for very specific problems.", accent: "#ddf247" },
  { slug: "generators", label: "Generators", description: "Press buttons. Receive delightful nonsense.", accent: "#55d9ff" },
  { slug: "rabbit-holes", label: "Rabbit holes", description: "One link away from losing an afternoon.", accent: "#c3a7ff" },
  { slug: "digital-art", label: "Digital art", description: "Screens that became a little bit magical.", accent: "#ff9b71" },
  { slug: "tiny-games", label: "Tiny games", description: "Quick little worlds with big opinions.", accent: "#82e8c5" },
  { slug: "science-maps", label: "Science & maps", description: "Zoom out. Zoom in. Wonder a bit.", accent: "#7ea6ff" },
  { slug: "sound-music", label: "Sound & music", description: "Noise, rhythm, and happy accidents.", accent: "#f59de8" },
];

export const CATEGORY_SLUGS = new Set(CATEGORIES.map((category) => category.slug));
export const MAX_RECENT_IDS = 50;
export const MAX_HISTORY_ITEMS = 100;
export const REPORT_THRESHOLD = 2;
export const DEAD_FAILURE_THRESHOLD = 3;
