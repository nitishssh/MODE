import type en from "../en/members";

const members: Record<keyof typeof en, string> = {
  // Page
  "members.eyebrow.club": "क्लब",
  "members.eyebrow.section": "सदस्य",
  "members.title": "सदस्य",
  "members.description": "क्लबमधील प्रत्येकजण, त्यांची भूमिका आणि त्यांच्या सदस्यत्वाची स्थिती.",
  "members.officerOnly.title": "डिरेक्टरी फक्त पदाधिकाऱ्यांसाठी",
  "members.officerOnly.body": "ईमेल आणि शुल्कासह सदस्य डिरेक्टरी आयोजक, खजिनदार आणि अ‍ॅडमिनना दिसते. तुमचा स्वतःचा पास \"माझा पास\" मध्ये आहे.",
  "members.runReminders": "स्मरणपत्रे पाठवा",
  "members.addMember": "सदस्य जोडा",
  "members.loadError": "डिरेक्टरी लोड होऊ शकली नाही",
  "members.added": "{name} यांना क्लबमध्ये जोडले.",

  // Metrics
  "members.metrics.label": "सदस्यत्वाचे आकडे",
  "members.metrics.total": "एकूण सदस्य",
  "members.metrics.totalHint": "क्लब नोंदवहीतील प्रत्येकजण",
  "members.metrics.active": "सक्रिय सदस्यत्व",
  "members.metrics.activeHint": "{count} संपलेले किंवा अजून सामील नाही",
  "members.metrics.loading": "लोड होत आहे",
  "members.metrics.expiring": "30 दिवसांत संपणारे",
  "members.metrics.expiringHint": "नूतनीकरण स्मरणपत्रे या सदस्यांना जातात",
  "members.metrics.officers": "पदाधिकारी",
  "members.metrics.officersHint": "स्वयंसेवक, आयोजक, खजिनदार आणि प्रमुख",

  // Toolbar
  "members.search": "सदस्य शोधा",
  "members.searchPlaceholder": "नाव किंवा ईमेल शोधा",
  "members.filterMembership": "सदस्यत्वानुसार फिल्टर करा",
  "members.filterRole": "भूमिकेनुसार फिल्टर करा",
  "members.allMemberships": "सर्व सदस्यत्वे",
  "members.allRoles": "सर्व भूमिका",
  "members.count.one": "{count} सदस्य",
  "members.count.many": "{count} सदस्य",

  // Directory
  "members.directory.kicker": "तुमच्या क्लबचे हृदय",
  "members.directory.title": "सदस्य डिरेक्टरी",
  "members.directory.noMatches": "काहीही जुळले नाही",
  "members.directory.noMatchesBody": "वेगळा शोध किंवा फिल्टर वापरून पाहा.",
  "members.directory.empty": "अजून सदस्य नाहीत",
  "members.directory.emptyBody": "सुरुवात करण्यासाठी पहिला सदस्य जोडा.",
  "members.col.dues": "सदस्यत्व शुल्क",
  "members.membershipExpired": "सदस्यत्व संपले",
  "members.notYetJoined": "अजून सामील नाही",

  // Expiring card
  "members.expiring.kicker": "नूतनीकरण बाकी",
  "members.expiring.title": "30 दिवसांच्या आत संपणारे",
  "members.expiring.none": "पुढील 30 दिवसांत कोणतेही सदस्यत्व संपत नाही.",
  "members.expiring.today": "आज संपते",
  "members.expiring.daysLeft.one": "{count} दिवस बाकी",
  "members.expiring.daysLeft.many": "{count} दिवस बाकी",
  "members.expiring.recordDues": "शुल्क नोंदवा",
  "members.previewNote": "शुल्क पदाधिकारी क्लबच्या ठरलेल्या वार्षिक रकमेनुसार नोंदवतात. नूतनीकरण स्मरणपत्रे अ‍ॅपमधील सूचना आणि सिम्युलेटेड आउटबॉक्स नोंदी तयार करतात; ईमेल पाठवला जात नाही.",

  // Add member panel
  "members.add.title": "सदस्य जोडा",
  "members.add.description": "लॉगिन किंवा पेमेंटशिवाय क्लब नोंद तयार करते. सदस्यत्व सक्रिय करण्यासाठी शुल्क स्वतंत्रपणे नोंदवा.",
  "members.add.fullName": "पूर्ण नाव",
  "members.add.namePlaceholder": "आशा डेमो",
  "members.add.emailPlaceholder": "asha@example.com",
  "members.add.submit": "डिरेक्टरीमध्ये जोडा",
  "members.add.nameError": "सदस्याचे नाव टाका (2–120 अक्षरे).",
  "members.add.emailError": "वैध ईमेल पत्ता टाका.",
  "members.add.duplicate": "या ईमेलचा सदस्य आधीपासूनच अस्तित्वात आहे.",
  "members.add.failed": "सदस्य जोडता आला नाही.",

  // Reminders panel
  "members.reminders.title": "नूतनीकरण स्मरणपत्रे पाठवा",
  "members.reminders.description": "ज्या सदस्यांचे सदस्यत्व या कालावधीत संपते, त्या प्रत्येकाला अ‍ॅपमधील एक सूचना आणि एक सिम्युलेटेड आउटबॉक्स नोंद. पुन्हा चालवल्यास त्याच समाप्तीसाठी आधीच स्मरण दिलेले सदस्य वगळले जातात.",
  "members.reminders.window": "कालावधी (दिवस)",
  "members.reminders.windowError": "1 ते 365 दरम्यान दिवसांची पूर्ण संख्या टाका.",
  "members.reminders.result": "पुढील {days} दिवसांसाठी स्मरणपत्रे पाठवली: {candidates} पात्र, {sent} पाठवली, {skipped} आधीच स्मरण दिलेले. डिलिव्हरी सिम्युलेटेड आहे; सिस्टममधून ईमेल जात नाही.",
  "members.reminders.failed": "स्मरणपत्रे पाठवता आली नाहीत.",

  // Detail page
  "members.detail.title": "सदस्य",
  "members.detail.officerOnly.title": "फक्त पदाधिकाऱ्यांसाठी पृष्ठ",
  "members.detail.officerOnly.body": "सदस्य नोंदी आयोजक, खजिनदार आणि अ‍ॅडमिनना दिसतात.",
  "members.detail.notFound": "सदस्य सापडला नाही",
  "members.detail.notFoundTitle": "या क्लबमध्ये असा सदस्य नाही",
  "members.detail.notFoundBody": "लिंक जुनी असेल, किंवा सदस्य दुसऱ्या क्लबचा आहे.",
  "members.detail.backToMembers": "सदस्यांकडे परत",
  "members.detail.allMembers": "सर्व सदस्य",
  "members.detail.profile.kicker": "सदस्य नोंद",
  "members.detail.profile.title": "प्रोफाइल",
  "members.detail.expiresOn": "समाप्ती तारीख",
  "members.detail.dues": "शुल्क",
  "members.detail.doorCode": "डोअर कोड",
  "members.detail.accessKicker": "प्रवेश",
  "members.detail.accessTitle": "भूमिका बदल",
  "members.detail.accessBody": "फक्त क्लब प्रमुखच भूमिका बदलू शकतात किंवा पासवर्ड सेट करू शकतात.",
  "members.detail.previewNote": "भूमिका बदल आणि पासवर्ड रीसेट ऑडिट ट्रेलमध्ये नोंदवले जातात. तोच संदर्भ पुन्हा पाठवणे सुरक्षित आहे आणि कधीही दोनदा जमा होत नाही.",

  // Dues history
  "members.history.kicker": "पेमेंट नोंदवही",
  "members.history.title": "शुल्क इतिहास",
  "members.history.empty": "अजून शुल्क नोंदवलेले नाही",
  "members.history.emptyBody": "पहिले पेमेंट सदस्यत्व 365 दिवसांसाठी सक्रिय करते.",
  "members.history.recorded": "नोंदवले",
  "members.history.expiry": "समाप्ती",
  "members.history.was": "आधी {date} होती",
  "members.history.first": "पहिले पेमेंट",

  // Dues card
  "members.dues.title": "शुल्क पेमेंट नोंदवा",
  "members.dues.description": "रक्कम म्हणजे क्लबचे ठरलेले वार्षिक शुल्क. पहिले पेमेंट सदस्यत्व 365 दिवसांसाठी सक्रिय करते; नूतनीकरण आज किंवा सध्याची समाप्ती, जी नंतरची असेल तिच्यात 365 दिवस जोडते, त्यामुळे लवकर भरल्याने दिवस कधीही वाया जात नाहीत.",
  "members.dues.reference": "पेमेंट संदर्भ",
  "members.dues.referencePlaceholder": "UPI / बँक / रोख पावती संदर्भ",
  "members.dues.referenceError": "पेमेंट संदर्भ टाका (किमान 3 अक्षरे).",
  "members.dues.submit": "पेमेंट नोंदवा",
  "members.dues.replayHint": "तोच संदर्भ पुन्हा पाठवणे सुरक्षित आहे: मूळ पेमेंटच परत दिले जाते.",
  "members.dues.recorded": "शुल्क नोंदवले. {name} यांचे सदस्यत्व आता {date} पर्यंत आहे.",
  "members.dues.replayed": "संदर्भ \"{reference}\" {name} यांच्यासाठी आधीच नोंदवलेला होता; काहीही पुन्हा जमा झाले नाही. सदस्यत्व {date} पर्यंत आहे.",

  // Role card
  "members.role.title": "भूमिका",
  "members.role.description": "भूमिका बदल ऑडिट ट्रेलमध्ये नोंदवले जातात.",
  "members.role.self": "तुम्ही स्वतःची भूमिका बदलू शकत नाही. दुसऱ्या अ‍ॅडमिनला सांगा.",
  "members.role.label": "क्लब भूमिका",
  "members.role.submit": "भूमिका बदला",
  "members.role.pickDifferent": "आधी वेगळी भूमिका निवडा.",
  "members.role.changed": "{name} आता {role} आहेत.",
  "members.role.ownRole": "तुम्ही स्वतःची भूमिका बदलू शकत नाही.",
  "members.role.failed": "भूमिका बदलता आली नाही.",

  // Password card
  "members.password.title": "पासवर्ड सेट करा",
  "members.password.description": "या सदस्याला लॉगिन देते, किंवा विसरलेला पासवर्ड रीसेट करते. हे ऑडिट केले जाते.",
  "members.password.new": "नवीन पासवर्ड",
  "members.password.confirm": "पासवर्डची खात्री करा",
  "members.password.submit": "पासवर्ड सेट करा",
  "members.password.lengthError": "8 ते 200 अक्षरे वापरा.",
  "members.password.mismatch": "पासवर्ड जुळत नाहीत.",
  "members.password.done": "{name} यांच्यासाठी पासवर्ड सेट केला. तो खासगीरीत्या सांगा; ते सेटिंग्जमधून बदलू शकतात.",
};

export default members;
