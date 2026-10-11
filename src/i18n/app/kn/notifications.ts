import type en from "../en/notifications";

const notifications: Record<keyof typeof en, string> = {
  "notifications.kicker": "ನೀವು",
  "notifications.kickerSection": "ಅಧಿಸೂಚನೆಗಳು",
  "notifications.title": "ಅಧಿಸೂಚನೆಗಳು",
  "notifications.lede": "ನಿಮಗೆ ಕಳುಹಿಸಿದ ಪ್ರಕಟಣೆಗಳು ಮತ್ತು ಶುಲ್ಕ ನೆನಪೋಲೆಗಳು.",
  "notifications.ledeUnread": "{count} ಓದಿಲ್ಲ. ನಿಮಗೆ ಕಳುಹಿಸಿದ ಪ್ರಕಟಣೆಗಳು ಮತ್ತು ಶುಲ್ಕ ನೆನಪೋಲೆಗಳು.",
  "notifications.tabAll": "ಎಲ್ಲಾ",
  "notifications.tabAnnouncements": "ಪ್ರಕಟಣೆಗಳು",
  "notifications.tabDues": "ಶುಲ್ಕ",
  "notifications.emptyFilterTitle": "ಈ ಫಿಲ್ಟರ್‌ನಲ್ಲಿ ಏನೂ ಇಲ್ಲ",
  "notifications.emptyFilterBody": "ಬೇರೆ ಫಿಲ್ಟರ್ ಪ್ರಯತ್ನಿಸಿ.",
  "notifications.emptyTitle": "ಇನ್ನೂ ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ",
  "notifications.emptyBody": "ಪ್ರಕಟಿತ ಪ್ರಕಟಣೆಗಳು ಮತ್ತು ನವೀಕರಣ ನೆನಪೋಲೆಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.",
  "notifications.kind.announcement": "ಪ್ರಕಟಣೆ",
  "notifications.kind.dues": "ಶುಲ್ಕ",
  "notifications.new": "ಹೊಸದು",
  "notifications.readAnnouncement": "ಪ್ರಕಟಣೆ ಓದಿ",
  "notifications.previewNote": "ಅಧಿಸೂಚನೆಗಳು ಆ್ಯಪ್‌ನಲ್ಲಿ ಮಾತ್ರ. ಸಂಬಂಧಿತ ಔಟ್‌ಬಾಕ್ಸ್ ಸಾಲುಗಳು ಸಿಮ್ಯುಲೇಟೆಡ್; ಇಮೇಲ್ ಅಥವಾ WhatsApp ಕಳುಹಿಸುವುದಿಲ್ಲ.",
};

export default notifications;
