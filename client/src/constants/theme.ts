export const colors = {
  light: { paper: '#FDFAF5', panel: '#F5F0E8', hairline: '#E8E4DC', ink: '#24201E', instruction: '#5C5C5C', marigold: '#F0A500', terracotta: '#CC785C', terracottaInk: '#AA5235', verified: '#2E7D5B', pending: '#A5563D', overdue: '#B3261E' },
  dark: { paper: '#1C1917', panel: '#24201E', hairline: '#3C3836', ink: '#F5F0E8', instruction: '#C8C3BB', marigold: '#F0A500', terracotta: '#CC785C', terracottaInk: '#CC785C', verified: '#3A9F73', pending: '#D99478', overdue: '#E4655D' },
} as const;
export const fonts = { display: 'Literata_500Medium', body: 'AnekLatin_400Regular', strong: 'AnekLatin_600SemiBold', devanagari: 'AnekDevanagari_400Regular', mono: 'JetBrainsMono_400Regular' };
export const space = (units: number) => units * 4;
export const radius = { input: 6, panel: 10, modal: 14 };
export const motion = { press: 80, transition: 180 };
export const typeScale = [11, 12.5, 14, 16, 19, 24, 30, 38, 48] as const;
