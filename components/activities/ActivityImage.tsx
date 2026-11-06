import { SafeImage } from "@/components/ui/SafeImage";
import { safeHttps } from "@/lib/activities";
import { thumbUrl } from "@/lib/activity-image-url";

/**
 * An activity's photograph at a fixed shape, cropped to fill (object-cover, centred). Cards and the strip use the small stored version; a
 * photo that fails to load simply disappears, leaving the surrounding colour. Renders nothing when the activity has no usable photo, so the
 * caller keeps its existing look.
 */
export function ActivityImage({ url, className = "", eager = false, small = true }: { url: string | null | undefined; className?: string; eager?: boolean; small?: boolean }) {
  const src = safeHttps(small ? thumbUrl(url) : url);
  if (!src) return null;
  return <SafeImage src={src} alt="" className={"h-full w-full object-cover " + className} loading={eager ? "eager" : "lazy"} />;
}
