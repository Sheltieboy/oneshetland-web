# Self-hosted fonts

These files are served from this repository, so a build never downloads fonts. They are the **latin subset** woff2 files exactly as Google Fonts serves them (the same files the site used through `next/font/google`), so rendering is unchanged.

| Family | Files | Licence | Source |
|---|---|---|---|
| Fraunces (variable weight axis) | `Fraunces-latin-normal.woff2`, `Fraunces-latin-italic.woff2` | SIL Open Font License 1.1, `OFL-fraunces.txt` | https://fonts.google.com/specimen/Fraunces (project: github.com/undercasetype/Fraunces) |
| Inter (variable weight axis) | `Inter-latin-variable.woff2` | SIL Open Font License 1.1, `OFL-inter.txt` | https://fonts.google.com/specimen/Inter (project: github.com/rsms/inter) |
| Instrument Serif | `InstrumentSerif-latin-normal.woff2`, `InstrumentSerif-latin-italic.woff2` | SIL Open Font License 1.1, `OFL-instrumentserif.txt` | https://fonts.google.com/specimen/Instrument+Serif (project: github.com/Instrument/instrument-serif) |

The OFL permits use, embedding and redistribution with the licence text kept alongside the fonts, which is why the three licence files sit in this folder. The files are unmodified. Fetched 10 Nov 2026 (Fraunces v38, Inter v20, Instrument Serif v5).

To change or add a face, replace the file here and update `app/layout.tsx` or `lib/editions/fonts.ts`.
