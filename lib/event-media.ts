/**
 * event-media.ts — did a person actually upload this picture, or did we put it there?
 *
 * WHY. Almost every event on OneShetland has a `cover_url`, but very few of them are the
 * organiser's own. The content loaders fill the gap with platform artwork so that no listing looks
 * bare: generic category pictures (`stage4a/category/02_community_social.jpg`) and stock pictures
 * chosen per event (`stage4a/EVT-martin-simpson-025.jpg`). That is right for the HERO, which only
 * has to set a scene.
 *
 * It is wrong for "The full picture", a section that says "everything the organiser put on it".
 * Over a stock photograph that sentence is simply untrue, and inviting someone to enlarge a piece
 * of generic category art wastes their tap. So the section asks this first.
 *
 * THE RULE. An upload is an object in the `event-media` bucket inside a per-account folder, which
 * is a UUID — that is the only shape the upload code writes (`<account-uuid>/events/cover-<ts>`).
 * Everything else is ours: the `stage4a/` library, and anything served from somewhere other than
 * the bucket. Deliberately strict: showing nothing is better than a false claim.
 *
 * Pure: no React, no React Native, no network. Shared, word for word, with the website.
 */

const UPLOAD_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/.+/i;
const BUCKET = /\/storage\/v1\/object\/public\/event-media\/(.+)$/;

/** True only for a picture a person uploaded against this event. */
export function isUploadedEventImage(url: string | null | undefined): boolean {
  const s = String(url ?? "").trim();
  if (!s) return false;
  const m = BUCKET.exec(s);
  if (!m) return false;
  // A query string or fragment is not part of the path.
  const path = m[1].split(/[?#]/)[0];
  return UPLOAD_PATH.test(path);
}

/** True for the artwork OneShetland supplies when an event has no picture of its own. */
export const isPlatformEventArtwork = (url: string | null | undefined): boolean =>
  !!String(url ?? "").trim() && !isUploadedEventImage(url);
