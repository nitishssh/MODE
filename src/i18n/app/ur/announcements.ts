import type en from "../en/announcements";

const announcements: Record<keyof typeof en, string> = {
  // Page
  "announcements.eyebrow.club": "کلب",
  "announcements.eyebrow.section": "نوٹس",
  "announcements.title": "اعلانات",
  "announcements.description": "کلب کی ہر شائع شدہ چیز کا تاریخ وار آرکائیو، نیا سب سے پہلے۔",
  "announcements.new": "نیا اعلان",
  "announcements.loading": "نوٹس بورڈ کھل رہا ہے…",
  "announcements.loadError": "نوٹس بورڈ لوڈ نہیں ہو سکا",
  "announcements.previewNote": "اشاعت ہر فعال ممبر کے لیے ایپ میں ایک اطلاع اور ایک نقلی آؤٹ باکس قطار بناتی ہے۔ کوئی ای میل یا WhatsApp نہیں بھیجا جاتا۔",

  // Publish result
  "announcements.result.published": "شائع ہو گیا",
  "announcements.result.alreadyPublished": "پہلے ہی شائع شدہ",
  "announcements.result.reach.one": "“{title}” ایپ میں {count} فعال ممبر تک پہنچا۔ ترسیل نقلی ہے: کوئی ای میل یا WhatsApp نہیں بھیجا گیا۔",
  "announcements.result.reach.many": "“{title}” ایپ میں {count} فعال ممبرز تک پہنچا۔ ترسیل نقلی ہے: کوئی ای میل یا WhatsApp نہیں بھیجا گیا۔",

  // Toolbar / archive
  "announcements.archive": "آرکائیو",
  "announcements.count.one": "{total} میں سے {visible} اعلان",
  "announcements.count.many": "{total} میں سے {visible} اعلانات",
  "announcements.search": "اعلانات تلاش کریں",
  "announcements.read": "پڑھیں",
  "announcements.empty.noMatch": "کوئی مماثل اعلان نہیں",
  "announcements.empty.quiet": "نوٹس بورڈ خاموش ہے",
  "announcements.empty.differentSearch": "کچھ اور تلاش کریں۔",
  "announcements.empty.publishFirst": "اوپر والے بٹن سے پہلا اعلان شائع کریں۔",
  "announcements.empty.none": "کلب کے شائع شدہ نوٹس یہاں نظر آتے ہیں۔",

  // Publish panel
  "announcements.publish.title": "اعلان شائع کریں",
  "announcements.publish.description": "اشاعت فوری ہوتی ہے اور ہر فعال ممبر کے لیے ایک اطلاع بناتی ہے۔ تصحیح کے لیے نیا اعلان درکار ہوگا۔",
  "announcements.publish.titleLabel": "عنوان",
  "announcements.publish.titlePlaceholder": "ممبرز کو کیا جاننا چاہیے",
  "announcements.publish.message": "پیغام",
  "announcements.publish.messagePlaceholder": "سادہ متن",
  "announcements.publish.counter": "{count} / 10,000 حروف۔ شائع ہونے تک مسودے اس براؤزر میں رہتے ہیں۔",
  "announcements.publish.titleError": "عنوان 3 سے 160 حروف کا ہونا چاہیے۔",
  "announcements.publish.bodyError": "پیغام 1 سے 10,000 حروف کا ہونا چاہیے۔",
  "announcements.publish.confirm": "ابھی شائع کریں؟ اس سے ہر فعال ممبر کو ایپ میں نوٹس جائے گا اور بعد میں ترمیم ممکن نہیں ہوگی۔",
  "announcements.publish.freshDraft": "نیا مسودہ شروع کریں",
  "announcements.publish.submit": "فعال ممبرز کے لیے شائع کریں",
  "announcements.publish.publishing": "شائع ہو رہا ہے…",
  "announcements.publish.discard": "مسودہ ضائع کریں",

  // Detail page
  "announcements.detail.title": "اعلان",
  "announcements.detail.publishedAt": "شائع شدہ {when}",
  "announcements.detail.all": "تمام اعلانات",
  "announcements.detail.loading": "نوٹس کھل رہا ہے…",
  "announcements.detail.unavailable": "اعلان دستیاب نہیں",
  "announcements.detail.notFound": "یہ اعلان نہیں مل سکا۔",

  // Outbox
  "announcements.outbox.kicker": "نقلی ترسیل",
  "announcements.outbox.title": "آؤٹ باکس",
  "announcements.outbox.reload": "دوبارہ لوڈ کریں",
  "announcements.outbox.footnote": "اشاعت کے وقت ہر فعال ممبر کے لیے ایک محفوظ قطار۔ قطار ثابت کرتی ہے کہ کیا درج ہوا، یہ نہیں کہ کوئی ای میل یا پیغام پہنچا: باہر کچھ نہیں بھیجا جاتا۔",
  "announcements.outbox.load": "وصول کنندگان لوڈ کریں",
  "announcements.outbox.loadError": "آؤٹ باکس لوڈ نہیں ہو سکا۔",
  "announcements.outbox.recipient": "وصول کنندہ",
  "announcements.outbox.subject": "موضوع",
  "announcements.outbox.recorded": "درج شدہ",
  "announcements.outbox.empty": "کوئی وصول کنندہ درج نہیں",
  "announcements.outbox.emptyBody": "اشاعت کے وقت کسی ممبر کی ممبرشپ فعال نہیں تھی۔",
};

export default announcements;
