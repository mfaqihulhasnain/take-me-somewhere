const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const groups = require("./seed-data.cjs");

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const categoryMeta = {
  "weird-web": ["Weird web", "The internet's stranger corners.", "#ff6b6b", 0],
  "useless-tools": ["Useless tools", "Tiny machines for very specific problems.", "#ddf247", 1],
  generators: ["Generators", "Press buttons. Receive delightful nonsense.", "#55d9ff", 2],
  "rabbit-holes": ["Rabbit holes", "One link away from losing an afternoon.", "#c3a7ff", 3],
  "digital-art": ["Digital art", "Screens that became a little bit magical.", "#ff9b71", 4],
  "tiny-games": ["Tiny games", "Quick little worlds with big opinions.", "#82e8c5", 5],
  "science-maps": ["Science & maps", "Zoom out. Zoom in. Wonder a bit.", "#7ea6ff", 6],
  "sound-music": ["Sound & music", "Noise, rhythm, and happy accidents.", "#f59de8", 7],
};

async function main() {
  const categories = new Map();
  for (const [slug, [label, description, accent, sortOrder]] of Object.entries(categoryMeta)) {
    const category = await prisma.category.upsert({ where: { slug }, update: { label, description, accent, sortOrder }, create: { slug, label, description, accent, sortOrder } });
    categories.set(slug, category.id);
  }

  const entries = Object.entries(groups).flatMap(([category, items]) => items.map((item) => ({ ...item, category })));
  if (entries.length < 200 || new Set(entries.map((item) => item.url)).size !== entries.length) throw new Error("Seed must contain at least 200 unique URLs.");
  for (const item of entries) {
    await prisma.destination.upsert({
      where: { url: item.url },
      update: { title: item.title, description: item.description, tags: item.tags, categoryId: categories.get(item.category), editorialScore: item.editorialScore, weirdness: item.weirdness, isNsfw: false },
      create: { url: item.url, title: item.title, description: item.description, tags: item.tags, categoryId: categories.get(item.category), editorialScore: item.editorialScore, weirdness: item.weirdness, isNsfw: false, healthStatus: "HEALTHY", moderationStatus: "APPROVED" },
    });
  }
  console.log(`Seeded ${entries.length} unique destinations across ${categories.size} categories.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); await pool.end(); });
