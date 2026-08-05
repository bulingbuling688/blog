import { spawn } from "node:child_process";
import process from "node:process";

const projectRoot = process.cwd();
const haloUrl = String(
	process.env.HALO_API_URL || process.env.PUBLIC_HALO_API_URL || "http://127.0.0.1:8090",
).replace(/\/+$/, "");
const contentApiBase = `${haloUrl}/apis/api.content.halo.run/v1alpha1`;
const settingsApiUrl = `${haloUrl}/apis/api.halo.run/v1alpha1/firefly/settings`;
const pollIntervalMs = Math.max(2_000, Number(process.env.HALO_POLL_INTERVAL_MS) || 5_000);
const requestTimeoutMs = 10_000;

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
let previewProcess;
let stopped = false;
let watcherTimer;

function stableStringify(value) {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

async function fetchJson(url) {
	const response = await fetch(url, {
		headers: { Accept: "application/json" },
		signal: AbortSignal.timeout(requestTimeoutMs),
	});
	if (!response.ok) throw new Error(`${response.status} ${url}`);
	return response.json();
}

async function getHaloSnapshot() {
	const [posts, categories, tags, settings] = await Promise.all([
		fetchJson(`${contentApiBase}/posts?size=1000&sort=spec.publishTime,desc`),
		fetchJson(`${contentApiBase}/categories?size=1000&sort=spec.priority,asc`),
		fetchJson(`${contentApiBase}/tags?size=1000&sort=spec.displayName,asc`),
		fetchJson(settingsApiUrl),
	]);
	return stableStringify({ posts, categories, tags, settings });
}

function runPnpm(args) {
	return new Promise((resolve) => {
		const child = spawn(pnpmCommand, args, {
			cwd: projectRoot,
			env: process.env,
			stdio: "inherit",
		});
		child.on("error", (error) => {
			console.error(`[Halo] command failed: ${error.message}`);
			resolve(1);
		});
		child.on("close", (code) => resolve(code ?? 1));
	});
}

async function rebuild(reason) {
	console.log(`[Halo] rebuilding Firefly (${reason})`);
	const code = await runPnpm(["build"]);
	if (code === 0) {
		console.log("[Halo] Firefly build completed");
	} else {
		console.error(`[Halo] Firefly build failed with exit code ${code}; keeping the previous build`);
	}
	return code === 0;
}

function previewArgs() {
	// `pnpm script -- ...` leaves the separator in process.argv; Astro should
	// receive only the actual preview flags.
	const args = process.argv.slice(2).filter((arg) => arg !== "--");
	if (!args.some((arg) => arg === "--host" || arg.startsWith("--host="))) {
		args.push("--host", process.env.HALO_PREVIEW_HOST || "127.0.0.1");
	}
	if (!args.some((arg) => arg === "--port" || arg.startsWith("--port="))) {
		args.push("--port", process.env.HALO_PREVIEW_PORT || "4321");
	}
	return args;
}

function stop(code = 0) {
	if (stopped) return;
	stopped = true;
	if (watcherTimer) clearTimeout(watcherTimer);
	if (previewProcess && !previewProcess.killed) previewProcess.kill("SIGTERM");
	process.exitCode = code;
}

async function watchHalo() {
	let lastSnapshot;
	let lastWarning = "";
	while (!stopped) {
		try {
			const snapshot = await getHaloSnapshot();
			lastWarning = "";
			if (lastSnapshot && snapshot !== lastSnapshot) {
				const rebuilt = await rebuild("Halo content or Firefly settings changed");
				if (rebuilt) {
					try {
						lastSnapshot = await getHaloSnapshot();
					} catch {
						lastSnapshot = snapshot;
					}
				} else {
					console.warn("[Halo] keeping the pending change so the next poll can retry the build");
				}
			} else {
				lastSnapshot = snapshot;
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (message !== lastWarning) {
				console.warn(`[Halo] change check unavailable; retrying: ${message}`);
				lastWarning = message;
			}
		}
		await new Promise((resolve) => {
			watcherTimer = setTimeout(resolve, pollIntervalMs);
		});
	}
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));

if (!(await rebuild("initial start"))) process.exit(1);

previewProcess = spawn(pnpmCommand, ["exec", "astro", "preview", ...previewArgs()], {
	cwd: projectRoot,
	env: process.env,
	stdio: "inherit",
});
previewProcess.once("error", (error) => {
	console.error(`[Halo] preview failed: ${error.message}`);
	stop(1);
});
previewProcess.once("close", (code) => {
	if (!stopped) stop(code ?? 1);
});

await watchHalo();
