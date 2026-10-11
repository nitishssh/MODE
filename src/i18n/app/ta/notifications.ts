import type en from "../en/notifications";

const notifications: Record<keyof typeof en, string> = {
  "notifications.kicker": "நீங்கள்",
  "notifications.kickerSection": "அறிவிப்பு எச்சரிக்கைகள்",
  "notifications.title": "அறிவிப்பு எச்சரிக்கைகள்",
  "notifications.lede": "உங்களுக்கு அனுப்பப்பட்ட அறிவிப்புகளும் கட்டண நினைவூட்டல்களும்.",
  "notifications.ledeUnread": "{count} படிக்கப்படாதவை. உங்களுக்கு அனுப்பப்பட்ட அறிவிப்புகளும் கட்டண நினைவூட்டல்களும்.",
  "notifications.tabAll": "அனைத்தும்",
  "notifications.tabAnnouncements": "அறிவிப்புகள்",
  "notifications.tabDues": "கட்டணம்",
  "notifications.emptyFilterTitle": "இந்த வடிகட்டியில் எதுவும் இல்லை",
  "notifications.emptyFilterBody": "வேறு வடிகட்டியை முயற்சிக்கவும்.",
  "notifications.emptyTitle": "இன்னும் அறிவிப்புகள் இல்லை",
  "notifications.emptyBody": "வெளியிடப்பட்ட அறிவிப்புகளும் புதுப்பித்தல் நினைவூட்டல்களும் இங்கே தோன்றும்.",
  "notifications.kind.announcement": "அறிவிப்பு",
  "notifications.kind.dues": "கட்டணம்",
  "notifications.new": "புதியது",
  "notifications.readAnnouncement": "அறிவிப்பைப் படி",
  "notifications.previewNote": "அறிவிப்புகள் செயலியில் மட்டுமே. தொடர்புடைய அவுட்பாக்ஸ் வரிசைகள் போலியானவை; மின்னஞ்சலோ WhatsApp செய்தியோ அனுப்பப்படாது.",
};

export default notifications;
