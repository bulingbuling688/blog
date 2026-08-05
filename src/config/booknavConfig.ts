import type { BooknavGroup, BooknavPageConfig } from "../types/booknavConfig";

// 书签导航页面配置
export const booknavPageConfig: BooknavPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// favicon 自动获取配置
	favicon: {
		// 书签未填写 icon 时，是否自动获取目标站点的 favicon 图标
		enabled: true,

		// favicon 接口地址，{domain} 为占位符，会被替换成目标站点域名
		// 更换接口只需保证地址里含有 {domain}，例如：
		//   https://a.favicon.im/{domain}
		//   https://favicon.im/{domain}
		api: "https://a.favicon.im/{domain}",
	},
};

// 书签导航配置
// 每个数组项是一个分类组，分类组内的 items 是该分类下的书签
export const booknavConfig: BooknavGroup[] = [
	{
		id: "dev",
		name: "开发",
		icon: "material-symbols:code-rounded",
		desc: "写代码时离不开的站点",
		weight: 100,
		items: [
			{
				title: "GitHub",
				url: "https://github.com",
				icon: "fa7-brands:github",
				desc: "代码托管与协作平台",
				weight: 100,
			},
			{
				title: "MDN",
				url: "https://developer.mozilla.org/zh-CN/",
				icon: "simple-icons:mdnwebdocs",
				desc: "Web 开发文档",
				weight: 90,
			},
			{
				title: "Stack Overflow",
				url: "https://stackoverflow.com",
				icon: "fa7-brands:stack-overflow",
				desc: "程序员问答社区",
				weight: 80,
			},
		],
	},
];
