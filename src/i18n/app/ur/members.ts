import type en from "../en/members";

const members: Record<keyof typeof en, string> = {
  // Page
  "members.eyebrow.club": "کلب",
  "members.eyebrow.section": "ممبرز",
  "members.title": "ممبرز",
  "members.description": "کلب کا ہر فرد، اس کا کردار، اور اس کی ممبرشپ کی حالت۔",
  "members.officerOnly.title": "صرف عہدیداروں کی ڈائریکٹری",
  "members.officerOnly.body": "ای میل اور فیس سمیت ممبر ڈائریکٹری آرگنائزرز، خزانچیوں اور ایڈمنز کو نظر آتی ہے۔ آپ کا اپنا پاس میرا پاس میں ہے۔",
  "members.runReminders": "یاد دہانیاں چلائیں",
  "members.addMember": "ممبر شامل کریں",
  "members.loadError": "ڈائریکٹری لوڈ نہیں ہو سکی",
  "members.added": "{name} کو کلب میں شامل کر دیا گیا۔",

  // Metrics
  "members.metrics.label": "ممبرشپ کے اعداد",
  "members.metrics.total": "کل ممبرز",
  "members.metrics.totalHint": "کلب رجسٹر میں موجود سب لوگ",
  "members.metrics.active": "فعال ممبرشپ",
  "members.metrics.activeHint": "{count} کی میعاد ختم یا ابھی شامل نہیں",
  "members.metrics.loading": "لوڈ ہو رہا ہے",
  "members.metrics.expiring": "30 دن میں میعاد ختم",
  "members.metrics.expiringHint": "تجدید کی یاد دہانیاں ان ممبرز کو جاتی ہیں",
  "members.metrics.officers": "عہدیدار",
  "members.metrics.officersHint": "والنٹیئرز، آرگنائزرز، خزانچی اور سربراہ",

  // Toolbar
  "members.search": "ممبرز تلاش کریں",
  "members.searchPlaceholder": "نام یا ای میل سے تلاش کریں",
  "members.filterMembership": "ممبرشپ کے لحاظ سے فلٹر",
  "members.filterRole": "کردار کے لحاظ سے فلٹر",
  "members.allMemberships": "تمام ممبرشپس",
  "members.allRoles": "تمام کردار",
  "members.count.one": "{count} ممبر",
  "members.count.many": "{count} ممبرز",

  // Directory
  "members.directory.kicker": "آپ کے کلب کا دل",
  "members.directory.title": "ممبر ڈائریکٹری",
  "members.directory.noMatches": "کوئی مماثلت نہیں",
  "members.directory.noMatchesBody": "کچھ اور تلاش کریں یا فلٹر بدلیں۔",
  "members.directory.empty": "ابھی کوئی ممبر نہیں",
  "members.directory.emptyBody": "شروع کرنے کے لیے پہلا ممبر شامل کریں۔",
  "members.col.dues": "ممبرشپ فیس",
  "members.membershipExpired": "ممبرشپ کی میعاد ختم",
  "members.notYetJoined": "ابھی شامل نہیں",

  // Expiring card
  "members.expiring.kicker": "تجدید باقی",
  "members.expiring.title": "30 دن کے اندر میعاد ختم",
  "members.expiring.none": "اگلے 30 دنوں میں کسی ممبرشپ کی میعاد ختم نہیں ہو رہی۔",
  "members.expiring.today": "آج میعاد ختم",
  "members.expiring.daysLeft.one": "{count} دن باقی",
  "members.expiring.daysLeft.many": "{count} دن باقی",
  "members.expiring.recordDues": "فیس درج کریں",
  "members.previewNote": "عہدیدار کلب کی مقررہ سالانہ رقم کے مطابق فیس درج کرتے ہیں۔ تجدید کی یاد دہانیاں ایپ کے اندر نوٹس اور نقلی آؤٹ باکس قطاریں بناتی ہیں؛ کوئی ای میل نہیں بھیجی جاتی۔",

  // Add member panel
  "members.add.title": "ممبر شامل کریں",
  "members.add.description": "لاگ ان یا ادائیگی کے بغیر کلب ریکارڈ بناتا ہے۔ ممبرشپ فعال کرنے کے لیے فیس الگ سے درج کریں۔",
  "members.add.fullName": "پورا نام",
  "members.add.namePlaceholder": "آشا ڈیمو",
  "members.add.emailPlaceholder": "asha@example.com",
  "members.add.submit": "ڈائریکٹری میں شامل کریں",
  "members.add.nameError": "ممبر کا نام درج کریں (2–120 حروف)۔",
  "members.add.emailError": "ایک درست ای میل پتہ درج کریں۔",
  "members.add.duplicate": "اس ای میل کے ساتھ ایک ممبر پہلے سے موجود ہے۔",
  "members.add.failed": "ہم ممبر شامل نہیں کر سکے۔",

  // Reminders panel
  "members.reminders.title": "تجدید کی یاد دہانیاں چلائیں",
  "members.reminders.description": "جن ممبرز کی ممبرشپ اس مدت میں ختم ہو رہی ہے، ہر ایک کے لیے ایپ میں ایک اطلاع اور ایک نقلی آؤٹ باکس قطار۔ دوبارہ چلانے پر اسی میعاد کے لیے پہلے یاد دہانی پانے والے ممبرز چھوڑ دیے جاتے ہیں۔",
  "members.reminders.window": "مدت (دن)",
  "members.reminders.windowError": "1 سے 365 کے درمیان دنوں کی ایک مکمل تعداد درج کریں۔",
  "members.reminders.result": "اگلے {days} دنوں کے لیے یاد دہانیاں چلائی گئیں: {candidates} امیدوار، {sent} کو بھیجی گئیں، {skipped} کو پہلے ہی یاد دہانی مل چکی تھی۔ ترسیل نقلی ہے؛ کوئی ای میل نظام سے باہر نہیں جاتی۔",
  "members.reminders.failed": "ہم یاد دہانیاں نہیں چلا سکے۔",

  // Detail page
  "members.detail.title": "ممبر",
  "members.detail.officerOnly.title": "صرف عہدیداروں کا صفحہ",
  "members.detail.officerOnly.body": "ممبر ریکارڈ آرگنائزرز، خزانچیوں اور ایڈمنز کو نظر آتے ہیں۔",
  "members.detail.notFound": "ممبر نہیں ملا",
  "members.detail.notFoundTitle": "اس کلب میں ایسا کوئی ممبر نہیں",
  "members.detail.notFoundBody": "شاید لنک پرانا ہے، یا ممبر کسی اور کلب کا ہے۔",
  "members.detail.backToMembers": "ممبرز پر واپس جائیں",
  "members.detail.allMembers": "تمام ممبرز",
  "members.detail.profile.kicker": "ممبر ریکارڈ",
  "members.detail.profile.title": "پروفائل",
  "members.detail.expiresOn": "میعاد ختم ہوگی",
  "members.detail.dues": "فیس",
  "members.detail.doorCode": "ڈور کوڈ",
  "members.detail.accessKicker": "رسائی",
  "members.detail.accessTitle": "کردار کی تبدیلی",
  "members.detail.accessBody": "صرف کلب سربراہ کردار بدل سکتا ہے یا پاس ورڈ مقرر کر سکتا ہے۔",
  "members.detail.previewNote": "کردار کی تبدیلی اور پاس ورڈ ری سیٹ آڈٹ ٹریل میں لکھے جاتے ہیں۔ ایک ہی حوالہ دوبارہ دینا محفوظ ہے اور کبھی دو بار کریڈٹ نہیں ہوتا۔",

  // Dues history
  "members.history.kicker": "ادائیگی رجسٹر",
  "members.history.title": "فیس کی تاریخ",
  "members.history.empty": "ابھی کوئی فیس درج نہیں",
  "members.history.emptyBody": "پہلی ادائیگی ممبرشپ کو 365 دن کے لیے فعال کرتی ہے۔",
  "members.history.recorded": "درج شدہ",
  "members.history.expiry": "میعاد",
  "members.history.was": "پہلے {date} تھی",
  "members.history.first": "پہلی ادائیگی",

  // Dues card
  "members.dues.title": "فیس کی ادائیگی درج کریں",
  "members.dues.description": "رقم کلب کی مقررہ سالانہ فیس ہے۔ پہلی ادائیگی ممبرشپ کو 365 دن کے لیے فعال کرتی ہے؛ تجدید آج اور موجودہ میعاد میں سے جو بعد میں ہو اس میں 365 دن جوڑتی ہے، اس لیے جلدی ادائیگی سے کوئی دن ضائع نہیں ہوتا۔",
  "members.dues.reference": "ادائیگی کا حوالہ",
  "members.dues.referencePlaceholder": "UPI / بینک / نقد رسید کا حوالہ",
  "members.dues.referenceError": "ادائیگی کا حوالہ درج کریں (کم از کم 3 حروف)۔",
  "members.dues.submit": "ادائیگی درج کریں",
  "members.dues.replayHint": "ایک ہی حوالہ دوبارہ دینا محفوظ ہے: اصل ادائیگی ہی واپس آتی ہے۔",
  "members.dues.recorded": "فیس درج ہو گئی۔ {name} کی ممبرشپ اب {date} تک ہے۔",
  "members.dues.replayed": "حوالہ \"{reference}\" {name} کے لیے پہلے ہی درج تھا؛ دوبارہ کچھ کریڈٹ نہیں ہوا۔ ممبرشپ {date} تک ہے۔",

  // Role card
  "members.role.title": "کردار",
  "members.role.description": "کردار کی تبدیلیاں آڈٹ ٹریل میں لکھی جاتی ہیں۔",
  "members.role.self": "آپ اپنا کردار خود نہیں بدل سکتے۔ کسی اور ایڈمن سے کہیں۔",
  "members.role.label": "کلب میں کردار",
  "members.role.submit": "کردار بدلیں",
  "members.role.pickDifferent": "پہلے کوئی مختلف کردار منتخب کریں۔",
  "members.role.changed": "{name} اب {role} ہے۔",
  "members.role.ownRole": "آپ اپنا کردار خود نہیں بدل سکتے۔",
  "members.role.failed": "ہم کردار نہیں بدل سکے۔",

  // Password card
  "members.password.title": "پاس ورڈ مقرر کریں",
  "members.password.description": "اس ممبر کو لاگ ان دیتا ہے، یا بھولا ہوا پاس ورڈ ری سیٹ کرتا ہے۔ یہ آڈٹ ہوتا ہے۔",
  "members.password.new": "نیا پاس ورڈ",
  "members.password.confirm": "پاس ورڈ کی تصدیق",
  "members.password.submit": "پاس ورڈ مقرر کریں",
  "members.password.lengthError": "8 سے 200 حروف استعمال کریں۔",
  "members.password.mismatch": "پاس ورڈ آپس میں نہیں ملتے۔",
  "members.password.done": "{name} کا پاس ورڈ مقرر ہو گیا۔ اسے نجی طور پر بتائیں؛ وہ ترتیبات سے بدل سکتے ہیں۔",
};

export default members;
