import type en from "../en/notifications";

const notifications: Record<keyof typeof en, string> = {
  "notifications.kicker": "آپ",
  "notifications.kickerSection": "اطلاعات",
  "notifications.title": "اطلاعات",
  "notifications.lede": "آپ کو بھیجے گئے اعلانات اور فیس کی یاد دہانیاں۔",
  "notifications.ledeUnread": "{count} غیر پڑھی۔ آپ کو بھیجے گئے اعلانات اور فیس کی یاد دہانیاں۔",
  "notifications.tabAll": "سب",
  "notifications.tabAnnouncements": "اعلانات",
  "notifications.tabDues": "فیس",
  "notifications.emptyFilterTitle": "اس فلٹر میں کچھ نہیں",
  "notifications.emptyFilterBody": "کوئی اور فلٹر آزمائیں۔",
  "notifications.emptyTitle": "ابھی کوئی اطلاع نہیں",
  "notifications.emptyBody": "شائع شدہ اعلانات اور تجدید کی یاد دہانیاں یہاں نظر آئیں گی۔",
  "notifications.kind.announcement": "اعلان",
  "notifications.kind.dues": "فیس",
  "notifications.new": "نیا",
  "notifications.readAnnouncement": "اعلان پڑھیں",
  "notifications.previewNote": "اطلاعات صرف ایپ کے اندر ہیں۔ متعلقہ آؤٹ باکس قطاریں نقلی ہیں؛ کوئی ای میل یا WhatsApp نہیں بھیجا جاتا۔",
};

export default notifications;
