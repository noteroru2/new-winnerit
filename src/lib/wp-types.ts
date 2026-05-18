export type WPPost = {
	id: number;
	slug: string;
	date: string;
	modified: string;
	link: string;
	title: { rendered: string };
	excerpt: { rendered: string; protected: boolean };
	/** Markdown body */
	content: { markdown: string; protected: boolean };
	featured_media?: number;
	categories?: number[];
};

export type WPMedia = {
	id: number;
	source_url: string;
	alt_text?: string;
	title?: { rendered: string };
	local_url?: string;
	media_details?: {
		width?: number;
		height?: number;
		sizes?: Record<
			string,
			{
				source_url?: string;
				width?: number;
				height?: number;
			}
		>;
	};
};

export type WPCategory = {
	id: number;
	name: string;
	slug: string;
	count?: number;
};
