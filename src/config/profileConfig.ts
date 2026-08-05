import type { ProfileConfig } from "../types/profileConfig";
import { haloSettings } from "./haloSettings";

const defaultProfileConfig: ProfileConfig = {
	// 头像
	// 图片路径支持三种格式：
	// 1. public 目录（以 "/" 开头，不优化）："/assets/images/avatar.webp"
	// 2. src 目录（不以 "/" 开头，自动优化但会增加构建时间，推荐）："assets/images/avatar.webp"
	// 3. 远程 URL："https://example.com/avatar.jpg"
	avatar: "",

	// 名字
	name: "我的博客",

	// 个人签名
	bio: "",

	// 链接配置
	// 已经预装的图标集：fa7-brands，fa7-regular，fa7-solid，material-symbols，simple-icons
	links: [],
};

const remoteProfile = haloSettings.profile ?? {};
const remoteLinks = Array.isArray(remoteProfile.links)
	? remoteProfile.links.filter(
			(link): link is Record<string, unknown> =>
				!!link && typeof link === "object" && typeof link.name === "string" && typeof link.icon === "string" && typeof link.url === "string",
		)
			.map((link) => ({
				name: link.name as string,
				icon: link.icon as string,
				url: link.url as string,
				...(typeof link.showName === "boolean" ? { showName: link.showName } : {}),
			}))
	: defaultProfileConfig.links;

export const profileConfig: ProfileConfig = {
	...defaultProfileConfig,
	...(typeof remoteProfile.avatar === "string" ? { avatar: remoteProfile.avatar } : {}),
	...(typeof remoteProfile.name === "string" && remoteProfile.name.trim()
		? { name: remoteProfile.name }
		: {}),
	...(typeof remoteProfile.bio === "string" ? { bio: remoteProfile.bio } : {}),
	links: Array.isArray(remoteProfile.links) ? remoteLinks : defaultProfileConfig.links,
};
