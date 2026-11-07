// Import only versioned public site artwork referenced by the captured frontend.
// No player/raid state, admin data or credentials are downloaded.
import { readFile, mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const files = ["index.html", "assets/css/leaderboard.css", "assets/js/leaderboard.js"];
const names = new Set();
for (const file of files) {
  const src = await readFile(resolve(root, file), "utf8");
  for (const m of src.matchAll(new RegExp("/assets/legacy/(leaderboard-[A-Za-z0-9-]+[.](?:webp|png|jpg|jpeg))", "g"))) names.add(m[1]);
}
if (names.size < 85 || names.size > 150) throw new Error("Unexpected image list: " + names.size + " assets. Review input before fetching.");
const dest = resolve(root, "assets/legacy");
await mkdir(dest, { recursive: true });
let done = 0;
for (const name of [...names].sort()) {
  const output = resolve(dest, name);
  try { if ((await stat(output)).size > 0) { ++done; continue; } } catch {}
  const url = "https://dmzranked.com/assets/legacy/" + encodeURIComponent(name);
  let last;
  for (let attempt = 0; attempt < 3; ++attempt) {
    try {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("HTTP " + response.status + " from " + url);
      const type = response.headers.get("content-type") || "";
      if (!["image/webp", "image/png", "image/jpeg"].some(t => type.toLowerCase().startsWith(t))) throw new Error("Unexpected content type " + type + " at " + url);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 10_000_000) throw new Error("Invalid image size for " + name);
      await writeFile(output, bytes);
      ++done;
      last = null;
      break;
    } catch (err) {
      last = err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  if (last) throw last;
}
console.log("Website public images present:", done, "of", names.size);
