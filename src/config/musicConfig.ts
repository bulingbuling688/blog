import type { MusicPlayerConfig } from "../types/musicConfig";
import { haloSettings } from "./haloSettings";

type MetingConfig = NonNullable<MusicPlayerConfig["meting"]>;
type LocalSong = NonNullable<NonNullable<MusicPlayerConfig["local"]>["playlist"]>[number];

const defaultMeting: MetingConfig = {
	api: "https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
	server: "netease",
	type: "playlist",
	id: "10046455237",
	auth: "",
	fallbackApis: [
		"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
		"https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
	],
};

const defaultPlaylist: LocalSong[] = [];

const remoteMusic = haloSettings.music ?? {};
const remoteMeting =
	remoteMusic.meting && typeof remoteMusic.meting === "object"
		? (remoteMusic.meting as Record<string, unknown>)
		: {};
const remoteLocal =
	remoteMusic.local && typeof remoteMusic.local === "object"
		? (remoteMusic.local as Record<string, unknown>)
		: {};

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function stringValue(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value)
		? Math.min(1, Math.max(0, value))
		: fallback;
}

function parsePlaylist(value: unknown): LocalSong[] {
	if (!Array.isArray(value)) return defaultPlaylist;
	return value.reduce<LocalSong[]>((playlist, song) => {
		if (!song || typeof song !== "object") return playlist;
		const item = song as Record<string, unknown>;
		if (typeof item.name !== "string" || typeof item.url !== "string") return playlist;
		playlist.push({
			name: item.name,
			artist: stringValue(item.artist, ""),
			url: item.url,
			...(typeof item.cover === "string" ? { cover: item.cover } : {}),
			...(typeof item.lrc === "string" ? { lrc: item.lrc } : {}),
		});
		return playlist;
	}, []);
}

const remotePlaylist = parsePlaylist(remoteLocal.playlist);

// 音乐播放器配置
export const musicPlayerConfig: MusicPlayerConfig = {
	showInNavbar:
		typeof remoteMusic.showInNavbar === "boolean" ? remoteMusic.showInNavbar : true,
	showInSidebar:
		typeof remoteMusic.showInSidebar === "boolean" ? remoteMusic.showInSidebar : true,
	mode:
		remoteMusic.mode === "meting"
			? "meting"
			: remoteMusic.mode === "local"
				? "local"
				: "meting",
	volume: numberValue(remoteMusic.volume, 0.7),
	playMode:
		remoteMusic.playMode === "one" || remoteMusic.playMode === "random"
			? remoteMusic.playMode
			: "list",
	showLyrics:
		typeof remoteMusic.showLyrics === "boolean" ? remoteMusic.showLyrics : true,
	meting: {
		...defaultMeting,
		...(typeof remoteMeting.api === "string" ? { api: remoteMeting.api } : {}),
		...(remoteMeting.server === "netease" ||
		remoteMeting.server === "tencent" ||
		remoteMeting.server === "kugou" ||
		remoteMeting.server === "xiami" ||
		remoteMeting.server === "baidu"
			? { server: remoteMeting.server }
			: {}),
		...(remoteMeting.type === "song" ||
		remoteMeting.type === "playlist" ||
		remoteMeting.type === "album" ||
		remoteMeting.type === "search" ||
		remoteMeting.type === "artist"
			? { type: remoteMeting.type }
			: {}),
		...(typeof remoteMeting.id === "string" ? { id: remoteMeting.id } : {}),
		...(isStringArray(remoteMeting.fallbackApis)
			? { fallbackApis: remoteMeting.fallbackApis }
			: {}),
	},

	// 本地音乐配置（当 mode 为 'local' 时使用）
	// 1. 支持传入歌词文件的路径
	// lrc: "/assets/music/lrc/使一颗心免于哀伤-哼唱.lrc",
	// 2. 或者直接填入歌词字符串内容
	// lrc: "[00:00.00]歌词内容...",
	local: {
		playlist: Array.isArray(remoteLocal.playlist) ? remotePlaylist : defaultPlaylist,
	},
};
