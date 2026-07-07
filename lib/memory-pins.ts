/**
 * memory-pins.ts — client-side write ops for image-pin annotations on memory
 * photos ("ask the community"). Mirrors the app's lib/memories-api.ts exactly:
 * same tables (memory_image_pins, memory_image_pin_suggestions) and the same
 * accept_image_pin_suggestion RPC.
 *
 * Schema: x/y are unit coords (0..1). A pin is a question ("who is this?");
 * other users SUGGEST answers; the memory author ACCEPTS one (which resolves
 * the pin and stamps resolved_answer). The author can also type their own
 * answer directly (resolve) or remove the pin.
 *
 * All ops are gated by RLS — callers must be signed in; the UI gates writes too.
 */

import { createClient } from "@/lib/supabase/client";
import type { MemoryImagePin, MemoryImagePinSuggestion } from "@/lib/memories-data";

/** Author drops a new pin on their own photo. */
export async function addImagePin(input: {
  mediaId: string; authorId: string; x: number; y: number; prompt: string;
}): Promise<MemoryImagePin> {
  const sb = createClient();
  const { data, error } = await sb
    .from("memory_image_pins")
    .insert({
      media_id: input.mediaId,
      author_id: input.authorId,
      x: Math.min(1, Math.max(0, input.x)),
      y: Math.min(1, Math.max(0, input.y)),
      prompt: input.prompt.trim(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MemoryImagePin;
}

/** Author types their own answer directly (resolves the pin). */
export async function resolveImagePin(pinId: string, answer: string, resolverId: string): Promise<MemoryImagePin> {
  const sb = createClient();
  const { data, error } = await sb
    .from("memory_image_pins")
    .update({
      resolved: true,
      resolved_answer: answer.trim(),
      resolved_by: resolverId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", pinId)
    .select("*")
    .single();
  if (error) throw error;
  return data as MemoryImagePin;
}

/** Author removes a pin (deletes the question, not the photo). */
export async function deleteImagePin(pinId: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("memory_image_pins").delete().eq("id", pinId);
  if (error) throw error;
}

/** Any signed-in user proposes an answer to an open pin. */
export async function suggestImagePinAnswer(input: {
  pinId: string; suggesterId: string; answer: string;
}): Promise<MemoryImagePinSuggestion> {
  const sb = createClient();
  const { data, error } = await sb
    .from("memory_image_pin_suggestions")
    .insert({
      pin_id: input.pinId,
      suggester_id: input.suggesterId,
      answer: input.answer.trim(),
    })
    .select("*, suggester:profiles!memory_image_pin_suggestions_suggester_id_fkey(id, full_name, display_name, avatar_url)")
    .single();
  if (error) throw error;
  return data as MemoryImagePinSuggestion;
}

/** A suggester withdraws their own suggestion. */
export async function deletePinSuggestion(suggestionId: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from("memory_image_pin_suggestions").delete().eq("id", suggestionId);
  if (error) throw error;
}

/**
 * Memory-author action: accept a suggestion. The SECURITY DEFINER RPC checks
 * the caller is the memory author, flips is_accepted, demotes siblings, and
 * stamps the pin with resolved_answer + credits the suggester. Returns the
 * freshly-resolved pin.
 */
export async function acceptImagePinSuggestion(suggestionId: string): Promise<MemoryImagePin> {
  const sb = createClient();
  const { data, error } = await sb.rpc("accept_image_pin_suggestion", { suggestion_id: suggestionId });
  if (error) throw error;
  return data as MemoryImagePin;
}
