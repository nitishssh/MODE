import type en from "../en/announcements";

const announcements: Record<keyof typeof en, string> = {
  // Page
  "announcements.eyebrow.club": "क्लब",
  "announcements.eyebrow.section": "सूचना",
  "announcements.title": "घोषणा",
  "announcements.description": "क्लबने प्रकाशित केलेल्या सगळ्याचा तारखेनुसार संग्रह, सर्वात नवीन आधी.",
  "announcements.new": "नवीन घोषणा",
  "announcements.loading": "नोटीस बोर्ड उघडत आहे…",
  "announcements.loadError": "नोटीस बोर्ड लोड होऊ शकला नाही",
  "announcements.previewNote": "प्रकाशनाने प्रत्येक सक्रिय सदस्यासाठी अ‍ॅपमधील एक सूचना आणि एक सिम्युलेटेड आउटबॉक्स नोंद तयार होते. ईमेल किंवा WhatsApp पाठवला जात नाही.",

  // Publish result
  "announcements.result.published": "प्रकाशित",
  "announcements.result.alreadyPublished": "आधीच प्रकाशित",
  "announcements.result.reach.one": "“{title}” अ‍ॅपमध्ये {count} सक्रिय सदस्यापर्यंत पोहोचली. डिलिव्हरी सिम्युलेटेड आहे: ईमेल किंवा WhatsApp पाठवला जात नाही.",
  "announcements.result.reach.many": "“{title}” अ‍ॅपमध्ये {count} सक्रिय सदस्यांपर्यंत पोहोचली. डिलिव्हरी सिम्युलेटेड आहे: ईमेल किंवा WhatsApp पाठवला जात नाही.",

  // Toolbar / archive
  "announcements.archive": "संग्रह",
  "announcements.count.one": "{total} पैकी {visible} घोषणा",
  "announcements.count.many": "{total} पैकी {visible} घोषणा",
  "announcements.search": "घोषणा शोधा",
  "announcements.read": "वाचा",
  "announcements.empty.noMatch": "जुळणारी कोणतीही घोषणा नाही",
  "announcements.empty.quiet": "नोटीस बोर्ड शांत आहे",
  "announcements.empty.differentSearch": "वेगळा शोध शब्द वापरून पाहा.",
  "announcements.empty.publishFirst": "वरील बटणाने पहिली घोषणा प्रकाशित करा.",
  "announcements.empty.none": "क्लबच्या प्रकाशित सूचना इथे दिसतात.",

  // Publish panel
  "announcements.publish.title": "घोषणा प्रकाशित करा",
  "announcements.publish.description": "प्रकाशन लगेच होते आणि प्रत्येक सक्रिय सदस्यासाठी एक सूचना तयार करते. दुरुस्तीसाठी नवीन घोषणा लागते.",
  "announcements.publish.titleLabel": "शीर्षक",
  "announcements.publish.titlePlaceholder": "सदस्यांना काय माहीत असायला हवे",
  "announcements.publish.message": "संदेश",
  "announcements.publish.messagePlaceholder": "साधा मजकूर",
  "announcements.publish.counter": "{count} / 10,000 अक्षरे. प्रकाशित होईपर्यंत मसुदे या ब्राउझरमध्ये ठेवले जातात.",
  "announcements.publish.titleError": "शीर्षक 3 ते 160 अक्षरांचे असावे.",
  "announcements.publish.bodyError": "मजकूर 1 ते 10,000 अक्षरांचा असावा.",
  "announcements.publish.confirm": "आता प्रकाशित करायचे? यामुळे प्रत्येक सक्रिय सदस्याला अ‍ॅपमध्ये सूचना जाईल आणि नंतर संपादन करता येणार नाही.",
  "announcements.publish.freshDraft": "नवीन मसुदा सुरू करा",
  "announcements.publish.submit": "सक्रिय सदस्यांसाठी प्रकाशित करा",
  "announcements.publish.publishing": "प्रकाशित करत आहे…",
  "announcements.publish.discard": "मसुदा टाकून द्या",

  // Detail page
  "announcements.detail.title": "घोषणा",
  "announcements.detail.publishedAt": "{when} प्रकाशित",
  "announcements.detail.all": "सर्व घोषणा",
  "announcements.detail.loading": "सूचना उघडत आहे…",
  "announcements.detail.unavailable": "घोषणा उपलब्ध नाही",
  "announcements.detail.notFound": "ही घोषणा सापडली नाही.",

  // Outbox
  "announcements.outbox.kicker": "सिम्युलेटेड डिलिव्हरी",
  "announcements.outbox.title": "आउटबॉक्स",
  "announcements.outbox.reload": "पुन्हा लोड करा",
  "announcements.outbox.footnote": "प्रकाशनाच्या वेळी प्रत्येक सक्रिय सदस्यासाठी एक साठवलेली नोंद. नोंद काय नोंदवले गेले हे सिद्ध करते, ईमेल किंवा संदेश पोहोचला हे नाही: बाहेर काहीही पाठवले जात नाही.",
  "announcements.outbox.load": "प्राप्तकर्ते लोड करा",
  "announcements.outbox.loadError": "आउटबॉक्स लोड करता आला नाही.",
  "announcements.outbox.recipient": "प्राप्तकर्ता",
  "announcements.outbox.subject": "विषय",
  "announcements.outbox.recorded": "नोंदवले",
  "announcements.outbox.empty": "कोणतेही प्राप्तकर्ते नोंदवलेले नाहीत",
  "announcements.outbox.emptyBody": "हे प्रकाशित झाले तेव्हा कोणत्याही सदस्याचे सदस्यत्व सक्रिय नव्हते.",
};

export default announcements;
