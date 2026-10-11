import type en from "../en/announcements";

const announcements: Record<keyof typeof en, string> = {
  // Page
  "announcements.eyebrow.club": "क्लब",
  "announcements.eyebrow.section": "सूचनाएँ",
  "announcements.title": "घोषणाएँ",
  "announcements.description": "क्लब ने जो कुछ प्रकाशित किया है उसका तारीख़वार संग्रह, सबसे नया पहले।",
  "announcements.new": "नई घोषणा",
  "announcements.loading": "नोटिसबोर्ड खुल रहा है…",
  "announcements.loadError": "नोटिसबोर्ड लोड नहीं हो सका",
  "announcements.previewNote": "प्रकाशन से हर सक्रिय सदस्य के लिए एक इन-ऐप सूचना और एक सिम्युलेटेड आउटबॉक्स पंक्ति बनती है। कोई ईमेल या WhatsApp नहीं भेजा जाता।",

  // Publish result
  "announcements.result.published": "प्रकाशित",
  "announcements.result.alreadyPublished": "पहले ही प्रकाशित",
  "announcements.result.reach.one": "“{title}” इन-ऐप {count} सक्रिय सदस्य तक पहुँची। डिलीवरी सिम्युलेटेड है: कोई ईमेल या WhatsApp नहीं भेजा जाता।",
  "announcements.result.reach.many": "“{title}” इन-ऐप {count} सक्रिय सदस्यों तक पहुँची। डिलीवरी सिम्युलेटेड है: कोई ईमेल या WhatsApp नहीं भेजा जाता।",

  // Toolbar / archive
  "announcements.archive": "संग्रह",
  "announcements.count.one": "{total} में से {visible} घोषणा",
  "announcements.count.many": "{total} में से {visible} घोषणाएँ",
  "announcements.search": "घोषणाएँ खोजें",
  "announcements.read": "पढ़ें",
  "announcements.empty.noMatch": "कोई मेल खाती घोषणा नहीं",
  "announcements.empty.quiet": "नोटिसबोर्ड पर अभी सन्नाटा है",
  "announcements.empty.differentSearch": "कोई और खोज शब्द आज़माएँ।",
  "announcements.empty.publishFirst": "ऊपर दिए बटन से पहली घोषणा प्रकाशित करें।",
  "announcements.empty.none": "क्लब की प्रकाशित सूचनाएँ यहाँ दिखती हैं।",

  // Publish panel
  "announcements.publish.title": "घोषणा प्रकाशित करें",
  "announcements.publish.description": "प्रकाशन तुरंत होता है और हर सक्रिय सदस्य के लिए एक सूचना बनाता है। सुधार के लिए नई घोषणा करनी होगी।",
  "announcements.publish.titleLabel": "शीर्षक",
  "announcements.publish.titlePlaceholder": "सदस्यों को क्या जानना चाहिए",
  "announcements.publish.message": "संदेश",
  "announcements.publish.messagePlaceholder": "सादा टेक्स्ट",
  "announcements.publish.counter": "{count} / 10,000 अक्षर। प्रकाशित होने तक ड्राफ़्ट इसी ब्राउज़र में रहते हैं।",
  "announcements.publish.titleError": "शीर्षक 3 से 160 अक्षरों का होना चाहिए।",
  "announcements.publish.bodyError": "संदेश 1 से 10,000 अक्षरों का होना चाहिए।",
  "announcements.publish.confirm": "अभी प्रकाशित करें? इससे हर सक्रिय सदस्य को इन-ऐप सूचना जाएगी और बाद में संपादन नहीं हो सकेगा।",
  "announcements.publish.freshDraft": "नया ड्राफ़्ट शुरू करें",
  "announcements.publish.submit": "सक्रिय सदस्यों के लिए प्रकाशित करें",
  "announcements.publish.publishing": "प्रकाशित हो रहा है…",
  "announcements.publish.discard": "ड्राफ़्ट हटाएँ",

  // Detail page
  "announcements.detail.title": "घोषणा",
  "announcements.detail.publishedAt": "{when} प्रकाशित",
  "announcements.detail.all": "सभी घोषणाएँ",
  "announcements.detail.loading": "सूचना खुल रही है…",
  "announcements.detail.unavailable": "घोषणा उपलब्ध नहीं",
  "announcements.detail.notFound": "यह घोषणा नहीं मिली।",

  // Outbox
  "announcements.outbox.kicker": "सिम्युलेटेड डिलीवरी",
  "announcements.outbox.title": "आउटबॉक्स",
  "announcements.outbox.reload": "फिर से लोड करें",
  "announcements.outbox.footnote": "प्रकाशन के समय हर सक्रिय सदस्य के लिए एक संग्रहीत पंक्ति। पंक्ति यह साबित करती है कि क्या दर्ज हुआ, यह नहीं कि कोई ईमेल या संदेश पहुँचा: बाहर कुछ नहीं भेजा जाता।",
  "announcements.outbox.load": "प्राप्तकर्ता लोड करें",
  "announcements.outbox.loadError": "आउटबॉक्स लोड नहीं हो सका।",
  "announcements.outbox.recipient": "प्राप्तकर्ता",
  "announcements.outbox.subject": "विषय",
  "announcements.outbox.recorded": "दर्ज किया गया",
  "announcements.outbox.empty": "कोई प्राप्तकर्ता दर्ज नहीं",
  "announcements.outbox.emptyBody": "प्रकाशन के समय किसी सदस्य की सदस्यता सक्रिय नहीं थी।",
};

export default announcements;
