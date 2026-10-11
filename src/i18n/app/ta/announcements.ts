import type en from "../en/announcements";

const announcements: Record<keyof typeof en, string> = {
  // Page
  "announcements.eyebrow.club": "கிளப்",
  "announcements.eyebrow.section": "அறிவிப்புகள்",
  "announcements.title": "அறிவிப்புகள்",
  "announcements.description": "கிளப் வெளியிட்ட அனைத்தின் தேதி வாரியான காப்பகம், புதியவை முதலில்.",
  "announcements.new": "புதிய அறிவிப்பு",
  "announcements.loading": "அறிவிப்புப் பலகையைத் திறக்கிறது…",
  "announcements.loadError": "அறிவிப்புப் பலகையை ஏற்ற முடியவில்லை",
  "announcements.previewNote": "வெளியீடு ஒவ்வொரு செயலில் உள்ள உறுப்பினருக்கும் ஒரு செயலி அறிவிப்பையும் ஒரு போலி அவுட்பாக்ஸ் வரிசையையும் உருவாக்கும். மின்னஞ்சலோ WhatsApp செய்தியோ அனுப்பப்படாது.",

  // Publish result
  "announcements.result.published": "வெளியிடப்பட்டது",
  "announcements.result.alreadyPublished": "ஏற்கனவே வெளியிடப்பட்டது",
  "announcements.result.reach.one": "“{title}” செயலியில் {count} செயலில் உள்ள உறுப்பினரைச் சென்றடைந்தது. விநியோகம் போலியானது: மின்னஞ்சலோ WhatsApp செய்தியோ அனுப்பப்படாது.",
  "announcements.result.reach.many": "“{title}” செயலியில் {count} செயலில் உள்ள உறுப்பினர்களைச் சென்றடைந்தது. விநியோகம் போலியானது: மின்னஞ்சலோ WhatsApp செய்தியோ அனுப்பப்படாது.",

  // Toolbar / archive
  "announcements.archive": "காப்பகம்",
  "announcements.count.one": "{total} இல் {visible} அறிவிப்பு",
  "announcements.count.many": "{total} இல் {visible} அறிவிப்புகள்",
  "announcements.search": "அறிவிப்புகளைத் தேடு",
  "announcements.read": "படி",
  "announcements.empty.noMatch": "பொருந்தும் அறிவிப்புகள் இல்லை",
  "announcements.empty.quiet": "அறிவிப்புப் பலகை அமைதியாக உள்ளது",
  "announcements.empty.differentSearch": "வேறு தேடலை முயற்சிக்கவும்.",
  "announcements.empty.publishFirst": "மேலே உள்ள பொத்தானால் முதல் அறிவிப்பை வெளியிடவும்.",
  "announcements.empty.none": "கிளப் வெளியிட்ட அறிவிப்புகள் இங்கே தோன்றும்.",

  // Publish panel
  "announcements.publish.title": "அறிவிப்பை வெளியிடு",
  "announcements.publish.description": "வெளியீடு உடனடியானது; ஒவ்வொரு செயலில் உள்ள உறுப்பினருக்கும் ஒரு அறிவிப்பை உருவாக்கும். திருத்தங்களுக்குப் புதிய அறிவிப்பு தேவை.",
  "announcements.publish.titleLabel": "தலைப்பு",
  "announcements.publish.titlePlaceholder": "உறுப்பினர்கள் தெரிந்து கொள்ள வேண்டியது",
  "announcements.publish.message": "செய்தி",
  "announcements.publish.messagePlaceholder": "எளிய உரை",
  "announcements.publish.counter": "{count} / 10,000 எழுத்துகள். வெளியிடும் வரை வரைவுகள் இந்த உலாவியில் வைக்கப்படும்.",
  "announcements.publish.titleError": "தலைப்பு 3 முதல் 160 எழுத்துகள் இருக்க வேண்டும்.",
  "announcements.publish.bodyError": "செய்தி 1 முதல் 10,000 எழுத்துகள் இருக்க வேண்டும்.",
  "announcements.publish.confirm": "இப்போதே வெளியிடவா? இது ஒவ்வொரு செயலில் உள்ள உறுப்பினருக்கும் செயலி அறிவிப்பை அனுப்பும்; பின்னர் திருத்த முடியாது.",
  "announcements.publish.freshDraft": "புதிய வரைவைத் தொடங்கு",
  "announcements.publish.submit": "செயலில் உள்ள உறுப்பினர்களுக்கு வெளியிடு",
  "announcements.publish.publishing": "வெளியிடுகிறது…",
  "announcements.publish.discard": "வரைவை நிராகரி",

  // Detail page
  "announcements.detail.title": "அறிவிப்பு",
  "announcements.detail.publishedAt": "{when} வெளியிடப்பட்டது",
  "announcements.detail.all": "அனைத்து அறிவிப்புகளும்",
  "announcements.detail.loading": "அறிவிப்பைத் திறக்கிறது…",
  "announcements.detail.unavailable": "அறிவிப்பு கிடைக்கவில்லை",
  "announcements.detail.notFound": "இந்த அறிவிப்பைக் கண்டறிய முடியவில்லை.",

  // Outbox
  "announcements.outbox.kicker": "போலி விநியோகம்",
  "announcements.outbox.title": "அவுட்பாக்ஸ்",
  "announcements.outbox.reload": "மீண்டும் ஏற்று",
  "announcements.outbox.footnote": "வெளியீட்டு நேரத்தில் செயலில் உள்ள ஒவ்வொரு உறுப்பினருக்கும் ஒரு சேமித்த வரிசை. வரிசை என்ன பதிவானது என்பதை நிரூபிக்கும்; மின்னஞ்சலோ செய்தியோ சென்றடைந்தது என்பதை அல்ல: வெளியே எதுவும் அனுப்பப்படாது.",
  "announcements.outbox.load": "பெறுநர்களை ஏற்று",
  "announcements.outbox.loadError": "அவுட்பாக்ஸை ஏற்ற முடியவில்லை.",
  "announcements.outbox.recipient": "பெறுநர்",
  "announcements.outbox.subject": "தலைப்பு",
  "announcements.outbox.recorded": "பதிவு செய்யப்பட்டது",
  "announcements.outbox.empty": "பெறுநர்கள் பதிவு செய்யப்படவில்லை",
  "announcements.outbox.emptyBody": "இது வெளியிடப்பட்டபோது எந்த உறுப்பினருக்கும் செயலில் உள்ள உறுப்பினர் நிலை இல்லை.",
};

export default announcements;
