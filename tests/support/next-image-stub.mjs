import { createElement as h } from "react";
export default function Image({ src, alt, fill, priority, unoptimized, ...r }) { return h("img", { src: typeof src === "string" ? src : "", alt, ...r }); }
