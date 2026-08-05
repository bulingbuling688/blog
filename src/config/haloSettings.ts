export type HaloSettings = {
	site?: Record<string, unknown>;
	appearance?: Record<string, unknown>;
	navigation?: Record<string, unknown>;
	wallpaper?: Record<string, unknown>;
	sidebar?: Record<string, unknown>;
	announcement?: Record<string, unknown>;
	profile?: Record<string, unknown>;
	music?: Record<string, unknown>;
};

// Vite provides import.meta.glob during Astro builds; Node-based scripts use defaults.
const settingsFiles =
	typeof import.meta.glob === "function"
		? import.meta.glob("../../.content/firefly-settings.json", {
				eager: true,
				query: "?raw",
				import: "default",
			})
		: {};

// The Vite glob mapping is only statically replaced in client bundles; during Astro's
// SSG page rendering the glob may evaluate to an empty object. Fall back to a direct
// `?raw` dynamic import so server-side rendering also reads the synced settings.
let rawSettings: string | undefined = Object.values(settingsFiles)[0];
if (!rawSettings) {
	try {
		const mod = await import("../../.content/firefly-settings.json?raw");
		rawSettings = (mod as { default?: string }).default;
	} catch {
		rawSettings = undefined;
	}
}

function readSettings(raw: string | undefined): HaloSettings {
	if (!raw) return {};
	try {
		const parsed: unknown = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? (parsed as HaloSettings) : {};
	} catch {
		return {};
	}
}

export const haloSettings: HaloSettings = readSettings(rawSettings);
