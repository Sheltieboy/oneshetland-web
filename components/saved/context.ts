"use client";

import { createContext, useContext } from "react";
import type { SaveOutcome, SavedRef, SavedType } from "@/lib/saved";

export type SaveToastOptions = { undo?: () => void };
export type SavedApi = {
  enabled: boolean;
  signedIn: boolean;
  isSaved: (ref: SavedRef) => boolean;
  /** A bookmark asks to know whether this item (any of its dates) is saved. Batched. */
  track: (type: SavedType, id: string) => void;
  save: (ref: SavedRef, opts?: { undo?: boolean; onUndo?: () => void }) => Promise<SaveOutcome>;
  unsave: (ref: SavedRef, opts?: { undo?: boolean; onUndo?: () => void }) => Promise<SaveOutcome>;
  /** Show a message (read out politely), optionally with Undo. */
  announce: (message: string, opts?: SaveToastOptions) => void;
};

export const OFF: SavedApi = {
  enabled: false, signedIn: false,
  isSaved: () => false, track: () => {},
  save: async () => "off", unsave: async () => "off", announce: () => {},
};

export const Ctx = createContext<SavedApi>(OFF);
export const useSaved = (): SavedApi => useContext(Ctx);

