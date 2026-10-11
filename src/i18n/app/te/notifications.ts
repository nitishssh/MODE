import type en from "../en/notifications";

const notifications: Record<keyof typeof en, string> = {
  "notifications.kicker": "మీరు",
  "notifications.kickerSection": "నోటిఫికేషన్లు",
  "notifications.title": "నోటిఫికేషన్లు",
  "notifications.lede": "మీకు పంపిన ప్రకటనలు మరియు రుసుము రిమైండర్లు.",
  "notifications.ledeUnread": "{count} చదవనివి. మీకు పంపిన ప్రకటనలు మరియు రుసుము రిమైండర్లు.",
  "notifications.tabAll": "అన్నీ",
  "notifications.tabAnnouncements": "ప్రకటనలు",
  "notifications.tabDues": "రుసుము",
  "notifications.emptyFilterTitle": "ఈ ఫిల్టర్‌లో ఏమీ లేదు",
  "notifications.emptyFilterBody": "వేరే ఫిల్టర్ ప్రయత్నించండి.",
  "notifications.emptyTitle": "ఇంకా నోటిఫికేషన్లు లేవు",
  "notifications.emptyBody": "ప్రచురించిన ప్రకటనలు మరియు పునరుద్ధరణ రిమైండర్లు ఇక్కడ కనిపిస్తాయి.",
  "notifications.kind.announcement": "ప్రకటన",
  "notifications.kind.dues": "రుసుము",
  "notifications.new": "కొత్తది",
  "notifications.readAnnouncement": "ప్రకటన చదవండి",
  "notifications.previewNote": "నోటిఫికేషన్లు యాప్‌లో మాత్రమే. సంబంధిత అవుట్‌బాక్స్ వరుసలు సిమ్యులేటెడ్; ఇమెయిల్ లేదా WhatsApp పంపబడదు.",
};

export default notifications;
