import type { AnnouncementConfig } from "../types/announcementConfig";
import { haloSettings } from "./haloSettings";

const defaultAnnouncementConfig: AnnouncementConfig = {
	// 公告标题
	title: "公告",

	// 公告内容
	content: "欢迎来到我的博客！这是一则示例公告。",

	// 是否允许用户关闭公告
	closable: true,

	link: {
		// 启用链接
		enable: true,
		// 链接文本
		text: "了解更多",
		// 链接 URL
		url: "/about/",
		// 内部链接
		external: false,
	},
};

const remoteAnnouncement = haloSettings.announcement ?? {};

export const announcementConfig: AnnouncementConfig = {
	...defaultAnnouncementConfig,
	title:
		typeof remoteAnnouncement.title === "string"
			? remoteAnnouncement.title
			: defaultAnnouncementConfig.title,
	content:
		typeof remoteAnnouncement.content === "string"
			? remoteAnnouncement.content
			: defaultAnnouncementConfig.content,
	closable:
		typeof remoteAnnouncement.closable === "boolean"
			? remoteAnnouncement.closable
			: defaultAnnouncementConfig.closable,
	link: {
		...defaultAnnouncementConfig.link,
		enable:
			typeof remoteAnnouncement.linkEnable === "boolean"
				? remoteAnnouncement.linkEnable
				: defaultAnnouncementConfig.link?.enable || false,
		text:
			typeof remoteAnnouncement.linkText === "string"
				? remoteAnnouncement.linkText
				: defaultAnnouncementConfig.link?.text || "",
		url:
			typeof remoteAnnouncement.linkUrl === "string"
				? remoteAnnouncement.linkUrl
				: defaultAnnouncementConfig.link?.url || "",
		external:
			typeof remoteAnnouncement.linkExternal === "boolean"
				? remoteAnnouncement.linkExternal
				: defaultAnnouncementConfig.link?.external || false,
	},
};
