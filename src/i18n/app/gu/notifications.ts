import type en from "../en/notifications";

const notifications: Record<keyof typeof en, string> = {
  "notifications.kicker": "તમે",
  "notifications.kickerSection": "સૂચનાઓ",
  "notifications.title": "સૂચનાઓ",
  "notifications.lede": "તમને મોકલેલી જાહેરાતો અને ફી રિમાઇન્ડર.",
  "notifications.ledeUnread": "{count} ન વાંચેલી. તમને મોકલેલી જાહેરાતો અને ફી રિમાઇન્ડર.",
  "notifications.tabAll": "બધી",
  "notifications.tabAnnouncements": "જાહેરાતો",
  "notifications.tabDues": "ફી",
  "notifications.emptyFilterTitle": "આ ફિલ્ટરમાં કંઈ નથી",
  "notifications.emptyFilterBody": "બીજું ફિલ્ટર અજમાવો.",
  "notifications.emptyTitle": "હજી કોઈ સૂચના નથી",
  "notifications.emptyBody": "પ્રકાશિત જાહેરાતો અને નવીકરણ રિમાઇન્ડર અહીં દેખાશે.",
  "notifications.kind.announcement": "જાહેરાત",
  "notifications.kind.dues": "ફી",
  "notifications.new": "નવું",
  "notifications.readAnnouncement": "જાહેરાત વાંચો",
  "notifications.previewNote": "સૂચનાઓ ફક્ત એપમાં છે. સંબંધિત આઉટબોક્સ એન્ટ્રીઓ સિમ્યુલેટેડ છે; કોઈ ઇમેઇલ કે WhatsApp મોકલાતો નથી.",
};

export default notifications;
