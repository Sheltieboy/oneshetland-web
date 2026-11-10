/**
 * Shareable addresses for programme items. A session (or an independently owned OneShetland event shown in the programme) is addressed as
 * /editions/<edition>/programme/<title-words>-<8 hex>. The words are for people and search engines; only the trailing key decides which item opens,
 * so renaming a session never breaks a shared link (the page redirects to the current spelling).
 */
export const slugWords = (title: string): string =>
  title.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "") || "item";
export const itemKey = (id: string): string => id.replace(/-/g, "").slice(0, 8).toLowerCase();
export const itemSlug = (title: string, id: string): string => `${slugWords(title)}-${itemKey(id)}`;
export const parseItemKey = (param: string): string | null => /(?:^|-)([0-9a-f]{8})$/.exec(param)?.[1] ?? null;
export const itemPath = (editionSlug: string, item: { title: string; id: string }): string => `/editions/${editionSlug}/programme/${itemSlug(item.title, item.id)}`;
