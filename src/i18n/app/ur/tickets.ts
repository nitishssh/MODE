import type en from "../en/tickets";

const tickets: Record<keyof typeof en, string> = {
  "tickets.eyebrowYou": "آپ",
  "tickets.eyebrow": "ٹکٹ",
  "tickets.title": "میرے ٹکٹ",
  "tickets.description": "بک شدہ نشست 30 منٹ کے لیے روکی جاتی ہے۔ ڈیسک پر عہدیدار آپ کی ادائیگی کنفرم کرتا ہے؛ اس کے بعد آپ کا QR دروازے پر داخلہ دیتا ہے۔",
  "tickets.browse": "ایونٹس دیکھیں",
  "tickets.live": "زندہ ({count})",
  "tickets.past": "گزشتہ ({count})",
  "tickets.emptyLive": "کوئی زندہ ٹکٹ نہیں",
  "tickets.emptyPast": "کوئی گزشتہ ٹکٹ نہیں",
  "tickets.findEvent": "ایونٹ تلاش کریں",
  "tickets.emptyLiveBody": "ایونٹس صفحے سے نشست بک کریں۔",
  "tickets.emptyPastBody": "منسوخ اور میعاد ختم ہولڈ یہاں نظر آتے ہیں۔",
  "tickets.eventFallback": "ایونٹ",
  "tickets.eventTile": "ایونٹ",
  "tickets.detailsUnavailable": "ایونٹ کی تفصیلات دستیاب نہیں",
  "tickets.qrAlt": "ٹکٹ QR۔ ٹائپ کرنے کا کوڈ {code}",
  "tickets.rate": "{pricing} ریٹ",
  "tickets.holdExpiresIn": "ہولڈ ختم ہونے میں",
  "tickets.eventDetails": "ایونٹ کی تفصیلات",
  "tickets.note": "ادا شدہ ٹکٹ منسوخ نہیں ہو سکتے: ریفنڈ اس نظام کے دائرے سے باہر ہے۔ داخلی دروازے پر والنٹیئر کو QR دکھائیں یا ڈور کوڈ بتائیں۔",
};

export default tickets;
