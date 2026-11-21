/** The site's one address, for canonicals, the sitemap and the share card. */
export const SITE_URL = "https://pc-flipper-toolkit.vercel.app";

export const SITE_NAME = "PC Flipper Toolkit";

/** A page's `<title>`: what it is, then the site's name. */
export const pageTitle = (page: string) => `${page} · ${SITE_NAME}`;
