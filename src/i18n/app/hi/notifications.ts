import type en from "../en/notifications";

const notifications: Record<keyof typeof en, string> = {
  "notifications.kicker": "आप",
  "notifications.kickerSection": "सूचनाएँ",
  "notifications.title": "सूचनाएँ",
  "notifications.lede": "आपको भेजी गई घोषणाएँ और शुल्क रिमाइंडर।",
  "notifications.ledeUnread": "{count} अपठित। आपको भेजी गई घोषणाएँ और शुल्क रिमाइंडर।",
  "notifications.tabAll": "सभी",
  "notifications.tabAnnouncements": "घोषणाएँ",
  "notifications.tabDues": "शुल्क",
  "notifications.emptyFilterTitle": "इस फ़िल्टर में कुछ नहीं",
  "notifications.emptyFilterBody": "कोई और फ़िल्टर आज़माएँ।",
  "notifications.emptyTitle": "अभी कोई सूचना नहीं",
  "notifications.emptyBody": "प्रकाशित घोषणाएँ और नवीनीकरण रिमाइंडर यहाँ दिखेंगे।",
  "notifications.kind.announcement": "घोषणा",
  "notifications.kind.dues": "शुल्क",
  "notifications.new": "नया",
  "notifications.readAnnouncement": "घोषणा पढ़ें",
  "notifications.previewNote": "सूचनाएँ सिर्फ़ इन-ऐप हैं। संबंधित आउटबॉक्स पंक्तियाँ सिम्युलेटेड हैं; कोई ईमेल या WhatsApp नहीं भेजा जाता।",
};

export default notifications;
