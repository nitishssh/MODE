/** Thinking Ledger / Ruled Paper tokens adapted from Class-mode's canonical palette. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { input: 6, panel: 10, modal: 14 } as const;
export const motion = { quick: 50, standard: 150, slow: 250 } as const;
export const lightTheme = { paper: "#fdfaf5", surface: "#fffdf9", ink: "#24201e", muted: "#5c5c5c", faint: "#9a9a9a", hairline: "#e8e4dc", rule: "#dce4ec", marginRule: "#cc785c", terracotta: "#aa5235", marigold: "#f0a500", green: "#2e7d5b", brown: "#a5563d", red: "#b3261e" } as const;
export const darkTheme = { paper: "#1c1917", surface: "#292524", ink: "#f5f0e8", muted: "#e0dbd3", faint: "#c8c3bb", hairline: "#3c3836", rule: "#4a4541", marginRule: "#cc785c", terracotta: "#cc785c", marigold: "#f0a500", green: "#3a9f73", brown: "#d99478", red: "#e4655d" } as const;
export type Theme = typeof lightTheme;
export const fontFamily = { display: "Literata", ui: "Anek", mono: "JetBrainsMono" } as const;
