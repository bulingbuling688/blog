import { rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

await rm(path.join(process.cwd(), ".astro"), { recursive: true, force: true });
await rm(path.join(process.cwd(), "node_modules", ".astro", "data-store.json"), {
	recursive: false,
	force: true,
});
