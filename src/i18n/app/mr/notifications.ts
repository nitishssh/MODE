import type en from "../en/notifications";

const notifications: Record<keyof typeof en, string> = {
  "notifications.kicker": "तुम्ही",
  "notifications.kickerSection": "सूचना",
  "notifications.title": "सूचना",
  "notifications.lede": "तुम्हाला पाठवलेल्या घोषणा आणि शुल्क स्मरणपत्रे.",
  "notifications.ledeUnread": "{count} न वाचलेल्या. तुम्हाला पाठवलेल्या घोषणा आणि शुल्क स्मरणपत्रे.",
  "notifications.tabAll": "सर्व",
  "notifications.tabAnnouncements": "घोषणा",
  "notifications.tabDues": "शुल्क",
  "notifications.emptyFilterTitle": "या फिल्टरमध्ये काही नाही",
  "notifications.emptyFilterBody": "दुसरा फिल्टर वापरून पाहा.",
  "notifications.emptyTitle": "अजून सूचना नाहीत",
  "notifications.emptyBody": "प्रकाशित घोषणा आणि नूतनीकरण स्मरणपत्रे इथे दिसतील.",
  "notifications.kind.announcement": "घोषणा",
  "notifications.kind.dues": "शुल्क",
  "notifications.new": "नवीन",
  "notifications.readAnnouncement": "घोषणा वाचा",
  "notifications.previewNote": "सूचना फक्त अ‍ॅपमध्ये आहेत. संबंधित आउटबॉक्स नोंदी सिम्युलेटेड आहेत; ईमेल किंवा WhatsApp पाठवला जात नाही.",
};

export default notifications;
