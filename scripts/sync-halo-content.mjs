import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedPostsDir = path.join(projectRoot, ".content", "posts");
const generatedSettingsFile = path.join(projectRoot, ".content", "firefly-settings.json");

const haloUrl = normalizeBaseUrl(
	process.env.HALO_API_URL || process.env.PUBLIC_HALO_API_URL || "http://127.0.0.1:8090",
);
const haloOrigin = new URL(haloUrl).origin;
const publicApiBase = `${haloUrl}/apis/api.content.halo.run/v1alpha1`;
const requestTimeoutMs = 15_000;

function normalizeBaseUrl(value) {
	return String(value).replace(/\/+$/, "");
}

function apiUrl(pathname) {
	return `${publicApiBase}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

async function requestJson(pathname) {
	const response = await fetch(apiUrl(pathname), {
		headers: { Accept: "application/json" },
		signal: AbortSignal.timeout(requestTimeoutMs),
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Halo API ${response.status} for ${pathname}: ${body.slice(0, 240)}`);
	}
	return response.json();
}

async function requestPublicJson(pathname) {
	const response = await fetch(`${haloUrl}${pathname}`, {
		headers: { Accept: "application/json" },
		signal: AbortSignal.timeout(requestTimeoutMs),
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Halo public API ${response.status} for ${pathname}: ${body.slice(0, 240)}`);
	}
	return response.json();
}

async function resetGeneratedPosts() {
	await rm(generatedPostsDir, { recursive: true, force: true });
	await mkdir(generatedPostsDir, { recursive: true });
}

async function useFallback(reason) {
	await mkdir(generatedPostsDir, { recursive: true });
	try {
		await access(generatedSettingsFile);
	} catch {
		await writeFile(generatedSettingsFile, "{}\n", "utf8");
	}
	console.warn(`[Halo] API unavailable; keeping the last synced content. ${reason}`);
}

function resolveHaloUrl(value) {
	if (!value) return "";
	try {
		return new URL(value, haloOrigin).toString();
	} catch {
		return value;
	}
}

function isAssetPath(value) {
	let pathname = value;
	try {
		const parsed = new URL(value, haloOrigin);
		if (parsed.origin !== haloOrigin) return false;
		pathname = parsed.pathname;
	} catch {
		return false;
	}

	return /^(?:\/?(?:upload|uploads|storage|files|attachments|images|api\/attachments|apis\/api\.storage\.halo\.run))(?:\/|$)/i.test(pathname);
}

function rewriteAssetValue(value) {
	const trimmed = String(value || "").trim();
	if (!trimmed || /^(?:data|blob|javascript):/i.test(trimmed)) return value;
	return isAssetPath(trimmed) ? resolveHaloUrl(trimmed) : value;
}

function rewriteSrcset(value) {
	return String(value || "")
		.split(",")
		.map((candidate) => {
			const match = candidate.trim().match(/^(\S+)(\s+.*)?$/);
			if (!match) return candidate;
			return `${rewriteAssetValue(match[1])}${match[2] || ""}`;
		})
		.join(", ");
}

function rewriteAssetUrls(content) {
	if (!content) return "";

	return content
		.replace(
			/(\b(?:src|poster|href|data-src|data-original)\s*=\s*["'])([^"']+)(["'])/gi,
			(_match, prefix, value, suffix) => `${prefix}${rewriteAssetValue(value)}${suffix}`,
		)
		.replace(
			/(\b(?:srcset|data-srcset)\s*=\s*["'])([^"']+)(["'])/gi,
			(_match, prefix, value, suffix) => `${prefix}${rewriteSrcset(value)}${suffix}`,
		)
		.replace(
			/(url\(\s*["']?)([^)\s"']+)(["']?\s*\))/gi,
			(_match, prefix, value, suffix) => `${prefix}${rewriteAssetValue(value)}${suffix}`,
		)
		.replace(
			/(!\[[^\]]*\]\()([^\s)]+)(\))/g,
			(_match, prefix, value, suffix) => `${prefix}${rewriteAssetValue(value)}${suffix}`,
		);
}

function safeFileName(value) {
	const normalized = String(value || "post")
		.normalize("NFKC")
		.replace(/[^\p{L}\p{N}._-]+/gu, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 120);
	return normalized || "post";
}

function yamlString(value) {
	return JSON.stringify(value ?? "");
}

function isoDate(value, fallback = new Date()) {
	const parsed = new Date(value || fallback);
	return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
}

function getDisplayName(item) {
	return item?.spec?.displayName || item?.spec?.name || item?.metadata?.name || "";
}

function getPostTerms(post, expandedKey, idsKey, termsByName) {
	const expanded = Array.isArray(post?.[expandedKey]) ? post[expandedKey] : [];
	const ids = Array.isArray(post?.spec?.[idsKey]) ? post.spec[idsKey] : [];
	const values = expanded.length ? expanded : ids;
	return values
		.map((term) =>
			typeof term === "string"
				? termsByName.get(term) || term
				: getDisplayName(term),
		)
		.map((tag) => String(tag).trim())
		.filter(Boolean);
}

function toMarkdown(post, terms) {
	const spec = post.spec || {};
	const status = post.status || {};
	const owner = post.owner || {};
	const categories = getPostTerms(post, "categories", "categories", terms.categories);
	const tags = getPostTerms(post, "tags", "tags", terms.tags);
	const description = status.excerpt || spec.excerpt?.raw || "";
	const content = rewriteAssetUrls(post.content?.raw || post.content?.content || "");
	const published = isoDate(spec.publishTime, post.metadata?.creationTimestamp);
	const updated = status.lastModifyTime && isoDate(status.lastModifyTime, new Date(published));

	return `---
title: ${yamlString(spec.title || "Untitled")}
published: ${published}
${updated ? `updated: ${updated}\n` : ""}draft: false
description: ${yamlString(description)}
image: ${yamlString(resolveHaloUrl(spec.cover || ""))}
tags: ${JSON.stringify(tags)}
category: ${yamlString(categories[0] || "")}
lang: "zh_CN"
pinned: ${Boolean(spec.pinned)}
author: ${yamlString(owner.displayName || spec.owner || "")}
sourceLink: ""
licenseName: ""
licenseUrl: ""
comment: ${spec.allowComment !== false}
password: ""
passwordHint: ""
haloName: ${yamlString(post.metadata?.name || "")}
haloSlug: ${yamlString(spec.slug || "")}
---

${content}
`;
}

function isDefaultHaloWelcomePost(post) {
	const spec = post?.spec || {};
	const content = post?.content?.raw || post?.content?.content || "";
	return (
		spec.slug === "hello-halo" &&
		spec.title === "Hello Halo" &&
		content.includes("这是一篇自动生成的文章")
	);
}

async function fetchAll(resource, params = {}) {
	const items = [];
	let page = 1;
	while (true) {
		const query = new URLSearchParams({
			page: String(page),
			size: "1000",
			...params,
		});
		const result = await requestJson(`/${resource}?${query}`);
		const pageItems = Array.isArray(result.items) ? result.items : [];
		items.push(...pageItems);
		if (!result.hasNext && (result.total == null || items.length >= result.total)) break;
		if (pageItems.length === 0) break;
		page += 1;
	}
	return items;
}

async function fetchContentTerms() {
	const [categories, tags] = await Promise.all([
		fetchAll("categories", { sort: "spec.priority,asc" }),
		fetchAll("tags", { sort: "spec.displayName,asc" }),
	]);
	const toMap = (items) =>
		new Map(
			items
				.map((item) => [item?.metadata?.name, getDisplayName(item)])
				.filter(([name, displayName]) => name && displayName),
		);
	return { categories: toMap(categories), tags: toMap(tags) };
}

async function fetchFireflySettings() {
	try {
		const settings = await requestPublicJson("/apis/api.halo.run/v1alpha1/firefly/settings");
		return {
			available: true,
			value: rewriteFireflySettings(settings && typeof settings === "object" ? settings : {}),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`[Halo] Firefly settings unavailable; keeping the last synced settings. ${message}`);
		return { available: false, value: {} };
	}
}

function rewriteFireflySettings(settings) {
	if (!settings || typeof settings !== "object") return {};
	const wallpaper = settings.wallpaper && typeof settings.wallpaper === "object" ? settings.wallpaper : {};
	const profile = settings.profile && typeof settings.profile === "object" ? settings.profile : {};
	const music = settings.music && typeof settings.music === "object" ? settings.music : {};
	const local = music.local && typeof music.local === "object" ? music.local : {};
	const rewriteAssetList = (value) =>
		Array.isArray(value) ? value.map((item) => rewriteAssetValue(item)) : rewriteAssetValue(value);
	const playlist = Array.isArray(local.playlist)
		? local.playlist.map((song) => {
				if (!song || typeof song !== "object") return song;
				return {
					...song,
					url: rewriteAssetValue(song.url),
					cover: rewriteAssetValue(song.cover),
					lrc: rewriteAssetValue(song.lrc),
				};
			})
		: local.playlist;

	return {
		...settings,
		wallpaper: {
			...wallpaper,
			desktop: rewriteAssetList(wallpaper.desktop),
			mobile: rewriteAssetList(wallpaper.mobile),
			playerUrl: rewriteAssetList(wallpaper.playerUrl),
		},
		profile: { ...profile, avatar: rewriteAssetValue(profile.avatar) },
		music: { ...music, local: { ...local, playlist } },
	};
}

async function main() {
	try {
		const terms = await fetchContentTerms();
		const fireflySettings = await fetchFireflySettings();
		const listedPosts = await fetchAll("posts", { sort: "spec.publishTime,desc" });
		const posts = [];
		let skippedWelcomePost = 0;
		for (const listedPost of listedPosts) {
			const name = listedPost?.metadata?.name;
			if (!name) continue;
			const post = await requestJson(`/posts/${encodeURIComponent(name)}`);
			if (isDefaultHaloWelcomePost(post)) {
				skippedWelcomePost += 1;
				continue;
			}
			posts.push(post);
		}
		await resetGeneratedPosts();
		if (fireflySettings.available) {
			await writeFile(generatedSettingsFile, `${JSON.stringify(fireflySettings.value, null, 2)}\n`, "utf8");
		} else {
			try {
				await access(generatedSettingsFile);
			} catch {
				await writeFile(generatedSettingsFile, "{}\n", "utf8");
			}
		}

		const usedNames = new Set();
		for (const post of posts) {
			const name = post?.metadata?.name;
			const baseName = safeFileName(post.spec?.slug || post.spec?.title || name);
			let fileName = `${baseName}.md`;
			if (usedNames.has(fileName)) fileName = `${baseName}-${name.slice(0, 8)}.md`;
			usedNames.add(fileName);
			await writeFile(path.join(generatedPostsDir, fileName), toMarkdown(post, terms), "utf8");
		}

		console.log(
			`[Halo] synced ${usedNames.size} published post(s), ${terms.categories.size} categor${terms.categories.size === 1 ? "y" : "ies"}, ${terms.tags.size} tag(s), and Firefly settings from ${haloOrigin}${skippedWelcomePost ? `; skipped ${skippedWelcomePost} Halo welcome post` : ""}`,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (process.env.HALO_REQUIRED === "true") throw error;
		await useFallback(message);
	}
}

await main();
