/** Shopify serves resized copies of its CDN images; ask for a sensible width rather than the multi-megabyte original. */
export const shopify = (url: string, w = 900) => `${url}${url.includes('?') ? '&' : '?'}width=${w}`;
