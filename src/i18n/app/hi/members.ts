import type en from "../en/members";

const members: Record<keyof typeof en, string> = {
  // Page
  "members.eyebrow.club": "क्लब",
  "members.eyebrow.section": "सदस्य",
  "members.title": "सदस्य",
  "members.description": "क्लब के सभी लोग, उनकी भूमिका और उनकी सदस्यता की स्थिति।",
  "members.officerOnly.title": "डायरेक्टरी सिर्फ़ पदाधिकारियों के लिए",
  "members.officerOnly.body": "ईमेल और शुल्क सहित सदस्य डायरेक्टरी आयोजकों, कोषाध्यक्षों और एडमिन को दिखती है। आपका अपना पास \"मेरा पास\" में है।",
  "members.runReminders": "रिमाइंडर चलाएँ",
  "members.addMember": "सदस्य जोड़ें",
  "members.loadError": "डायरेक्टरी लोड नहीं हो सकी",
  "members.added": "{name} को क्लब में जोड़ दिया गया।",

  // Metrics
  "members.metrics.label": "सदस्यता के आँकड़े",
  "members.metrics.total": "कुल सदस्य",
  "members.metrics.totalHint": "क्लब रजिस्टर के सभी लोग",
  "members.metrics.active": "सक्रिय सदस्यता",
  "members.metrics.activeHint": "{count} समाप्त या अभी शामिल नहीं",
  "members.metrics.loading": "लोड हो रहा है",
  "members.metrics.expiring": "30 दिनों में समाप्त",
  "members.metrics.expiringHint": "नवीनीकरण रिमाइंडर इन सदस्यों को जाते हैं",
  "members.metrics.officers": "पदाधिकारी",
  "members.metrics.officersHint": "वॉलंटियर, आयोजक, कोषाध्यक्ष और प्रमुख",

  // Toolbar
  "members.search": "सदस्य खोजें",
  "members.searchPlaceholder": "नाम या ईमेल खोजें",
  "members.filterMembership": "सदस्यता के अनुसार फ़िल्टर करें",
  "members.filterRole": "भूमिका के अनुसार फ़िल्टर करें",
  "members.allMemberships": "सभी सदस्यताएँ",
  "members.allRoles": "सभी भूमिकाएँ",
  "members.count.one": "{count} सदस्य",
  "members.count.many": "{count} सदस्य",

  // Directory
  "members.directory.kicker": "आपके क्लब का दिल",
  "members.directory.title": "सदस्य डायरेक्टरी",
  "members.directory.noMatches": "कोई मेल नहीं",
  "members.directory.noMatchesBody": "कोई और खोज या फ़िल्टर आज़माएँ।",
  "members.directory.empty": "अभी कोई सदस्य नहीं",
  "members.directory.emptyBody": "शुरू करने के लिए पहला सदस्य जोड़ें।",
  "members.col.dues": "सदस्यता शुल्क",
  "members.membershipExpired": "सदस्यता समाप्त",
  "members.notYetJoined": "अभी शामिल नहीं",

  // Expiring card
  "members.expiring.kicker": "नवीनीकरण बाकी",
  "members.expiring.title": "30 दिनों के भीतर समाप्त",
  "members.expiring.none": "अगले 30 दिनों में कोई सदस्यता समाप्त नहीं हो रही।",
  "members.expiring.today": "आज समाप्त",
  "members.expiring.daysLeft.one": "{count} दिन बाकी",
  "members.expiring.daysLeft.many": "{count} दिन बाकी",
  "members.expiring.recordDues": "शुल्क दर्ज करें",
  "members.previewNote": "शुल्क पदाधिकारी क्लब की तय वार्षिक राशि के हिसाब से दर्ज करते हैं। नवीनीकरण रिमाइंडर इन-ऐप सूचनाएँ और सिम्युलेटेड आउटबॉक्स पंक्तियाँ बनाते हैं; कोई ईमेल नहीं भेजा जाता।",

  // Add member panel
  "members.add.title": "सदस्य जोड़ें",
  "members.add.description": "बिना लॉगिन या भुगतान के क्लब रिकॉर्ड बनाता है। सदस्यता सक्रिय करने के लिए शुल्क अलग से दर्ज करें।",
  "members.add.fullName": "पूरा नाम",
  "members.add.namePlaceholder": "आशा डेमो",
  "members.add.emailPlaceholder": "asha@example.com",
  "members.add.submit": "डायरेक्टरी में जोड़ें",
  "members.add.nameError": "सदस्य का नाम दर्ज करें (2–120 अक्षर)।",
  "members.add.emailError": "एक सही ईमेल पता दर्ज करें।",
  "members.add.duplicate": "इस ईमेल वाला सदस्य पहले से मौजूद है।",
  "members.add.failed": "सदस्य जोड़ा नहीं जा सका।",

  // Reminders panel
  "members.reminders.title": "नवीनीकरण रिमाइंडर चलाएँ",
  "members.reminders.description": "जिन सदस्यों की सदस्यता इस अवधि में समाप्त हो रही है, उनमें से हर एक को एक इन-ऐप सूचना और एक सिम्युलेटेड आउटबॉक्स पंक्ति। दोबारा चलाने पर उसी समाप्ति के लिए पहले से याद दिलाए गए सदस्य छोड़ दिए जाते हैं।",
  "members.reminders.window": "अवधि (दिन)",
  "members.reminders.windowError": "1 से 365 के बीच दिनों की पूर्ण संख्या दर्ज करें।",
  "members.reminders.result": "अगले {days} दिनों के लिए रिमाइंडर चले: {candidates} पात्र, {sent} भेजे गए, {skipped} पहले ही याद दिलाए गए। डिलीवरी सिम्युलेटेड है; सिस्टम से कोई ईमेल नहीं जाता।",
  "members.reminders.failed": "रिमाइंडर नहीं चलाए जा सके।",

  // Detail page
  "members.detail.title": "सदस्य",
  "members.detail.officerOnly.title": "सिर्फ़ पदाधिकारियों के लिए पेज",
  "members.detail.officerOnly.body": "सदस्य रिकॉर्ड आयोजकों, कोषाध्यक्षों और एडमिन को दिखते हैं।",
  "members.detail.notFound": "सदस्य नहीं मिला",
  "members.detail.notFoundTitle": "इस क्लब में ऐसा कोई सदस्य नहीं",
  "members.detail.notFoundBody": "लिंक शायद पुराना है, या सदस्य किसी और क्लब का है।",
  "members.detail.backToMembers": "सदस्यों पर लौटें",
  "members.detail.allMembers": "सभी सदस्य",
  "members.detail.profile.kicker": "सदस्य रिकॉर्ड",
  "members.detail.profile.title": "प्रोफ़ाइल",
  "members.detail.expiresOn": "समाप्ति तिथि",
  "members.detail.dues": "शुल्क",
  "members.detail.doorCode": "डोर कोड",
  "members.detail.accessKicker": "एक्सेस",
  "members.detail.accessTitle": "भूमिका बदलाव",
  "members.detail.accessBody": "सिर्फ़ क्लब प्रमुख ही भूमिका बदल सकते हैं या पासवर्ड सेट कर सकते हैं।",
  "members.detail.previewNote": "भूमिका बदलाव और पासवर्ड रीसेट ऑडिट ट्रेल में दर्ज होते हैं। एक ही संदर्भ दोबारा भेजना सुरक्षित है और कभी दो बार क्रेडिट नहीं होता।",

  // Dues history
  "members.history.kicker": "भुगतान रजिस्टर",
  "members.history.title": "शुल्क इतिहास",
  "members.history.empty": "अभी कोई शुल्क दर्ज नहीं",
  "members.history.emptyBody": "पहला भुगतान सदस्यता को 365 दिनों के लिए सक्रिय करता है।",
  "members.history.recorded": "दर्ज किया गया",
  "members.history.expiry": "समाप्ति",
  "members.history.was": "पहले {date} था",
  "members.history.first": "पहला भुगतान",

  // Dues card
  "members.dues.title": "शुल्क भुगतान दर्ज करें",
  "members.dues.description": "राशि क्लब का तय वार्षिक शुल्क है। पहला भुगतान सदस्यता को 365 दिनों के लिए सक्रिय करता है; नवीनीकरण आज या वर्तमान समाप्ति — जो भी बाद में हो — उसमें 365 दिन जोड़ता है, इसलिए जल्दी भुगतान करने पर कोई दिन नहीं घटता।",
  "members.dues.reference": "भुगतान संदर्भ",
  "members.dues.referencePlaceholder": "UPI / बैंक / नकद रसीद संदर्भ",
  "members.dues.referenceError": "भुगतान संदर्भ दर्ज करें (कम से कम 3 अक्षर)।",
  "members.dues.submit": "भुगतान दर्ज करें",
  "members.dues.replayHint": "एक ही संदर्भ दोबारा भेजना सुरक्षित है: मूल भुगतान ही लौटाया जाता है।",
  "members.dues.recorded": "शुल्क दर्ज हो गया। {name} की सदस्यता अब {date} तक है।",
  "members.dues.replayed": "संदर्भ \"{reference}\" {name} के लिए पहले से दर्ज था; कुछ भी दोबारा क्रेडिट नहीं हुआ। सदस्यता {date} तक है।",

  // Role card
  "members.role.title": "भूमिका",
  "members.role.description": "भूमिका बदलाव ऑडिट ट्रेल में दर्ज होते हैं।",
  "members.role.self": "आप अपनी भूमिका खुद नहीं बदल सकते। किसी और एडमिन से कहें।",
  "members.role.label": "क्लब भूमिका",
  "members.role.submit": "भूमिका बदलें",
  "members.role.pickDifferent": "पहले कोई अलग भूमिका चुनें।",
  "members.role.changed": "{name} अब {role} हैं।",
  "members.role.ownRole": "आप अपनी भूमिका खुद नहीं बदल सकते।",
  "members.role.failed": "भूमिका बदली नहीं जा सकी।",

  // Password card
  "members.password.title": "पासवर्ड सेट करें",
  "members.password.description": "इस सदस्य को लॉगिन देता है, या भूला हुआ पासवर्ड रीसेट करता है। यह ऑडिट में दर्ज होता है।",
  "members.password.new": "नया पासवर्ड",
  "members.password.confirm": "पासवर्ड की पुष्टि करें",
  "members.password.submit": "पासवर्ड सेट करें",
  "members.password.lengthError": "8 से 200 अक्षर इस्तेमाल करें।",
  "members.password.mismatch": "पासवर्ड मेल नहीं खाते।",
  "members.password.done": "{name} के लिए पासवर्ड सेट हो गया। इसे निजी तौर पर साझा करें; वे इसे सेटिंग्स से बदल सकते हैं।",
};

export default members;
