import type en from "../en/members";

const members: Record<keyof typeof en, string> = {
  // Page
  "members.eyebrow.club": "கிளப்",
  "members.eyebrow.section": "உறுப்பினர்கள்",
  "members.title": "உறுப்பினர்கள்",
  "members.description": "கிளப்பில் உள்ள அனைவரும், அவர்களின் பங்கு, அவர்களின் உறுப்பினர் நிலை.",
  "members.officerOnly.title": "அதிகாரிகளுக்கு மட்டுமான அடைவு",
  "members.officerOnly.body": "மின்னஞ்சல்களும் கட்டணங்களும் கொண்ட உறுப்பினர் அடைவு ஏற்பாட்டாளர்கள், பொருளாளர்கள், நிர்வாகிகளுக்குத் தெரியும். உங்கள் சொந்த பாஸ் “எனது பாஸ்” இல் உள்ளது.",
  "members.runReminders": "நினைவூட்டல்களை அனுப்பு",
  "members.addMember": "உறுப்பினரைச் சேர்",
  "members.loadError": "அடைவை ஏற்ற முடியவில்லை",
  "members.added": "{name} கிளப்பில் சேர்க்கப்பட்டார்.",

  // Metrics
  "members.metrics.label": "உறுப்பினர் எண்ணிக்கைகள்",
  "members.metrics.total": "மொத்த உறுப்பினர்கள்",
  "members.metrics.totalHint": "கிளப் பதிவேட்டில் உள்ள அனைவரும்",
  "members.metrics.active": "செயலில் உள்ள உறுப்பினர் நிலை",
  "members.metrics.activeHint": "{count} காலாவதியானவை அல்லது இன்னும் சேராதவை",
  "members.metrics.loading": "ஏற்றுகிறது",
  "members.metrics.expiring": "30 நாட்களில் காலாவதியாகும்",
  "members.metrics.expiringHint": "புதுப்பித்தல் நினைவூட்டல்கள் இந்த உறுப்பினர்களுக்குச் செல்லும்",
  "members.metrics.officers": "அதிகாரிகள்",
  "members.metrics.officersHint": "தன்னார்வலர்கள், ஏற்பாட்டாளர்கள், பொருளாளர்கள், தலைவர்கள்",

  // Toolbar
  "members.search": "உறுப்பினர்களைத் தேடு",
  "members.searchPlaceholder": "பெயர் அல்லது மின்னஞ்சலைத் தேடு",
  "members.filterMembership": "உறுப்பினர் நிலை வாரியாக வடிகட்டு",
  "members.filterRole": "பங்கு வாரியாக வடிகட்டு",
  "members.allMemberships": "அனைத்து உறுப்பினர் நிலைகளும்",
  "members.allRoles": "அனைத்துப் பங்குகளும்",
  "members.count.one": "{count} உறுப்பினர்",
  "members.count.many": "{count} உறுப்பினர்கள்",

  // Directory
  "members.directory.kicker": "உங்கள் கிளப்பின் இதயம்",
  "members.directory.title": "உறுப்பினர் அடைவு",
  "members.directory.noMatches": "பொருத்தங்கள் இல்லை",
  "members.directory.noMatchesBody": "வேறு தேடல் அல்லது வடிகட்டியை முயற்சிக்கவும்.",
  "members.directory.empty": "இன்னும் உறுப்பினர்கள் இல்லை",
  "members.directory.emptyBody": "தொடங்க முதல் உறுப்பினரைச் சேர்க்கவும்.",
  "members.col.dues": "உறுப்பினர் கட்டணம்",
  "members.membershipExpired": "உறுப்பினர் நிலை காலாவதியானது",
  "members.notYetJoined": "இன்னும் சேரவில்லை",

  // Expiring card
  "members.expiring.kicker": "புதுப்பித்தல்கள் நிலுவையில்",
  "members.expiring.title": "30 நாட்களுக்குள் காலாவதியாகும்",
  "members.expiring.none": "அடுத்த 30 நாட்களில் எந்த உறுப்பினர் நிலையும் காலாவதியாகாது.",
  "members.expiring.today": "இன்று காலாவதியாகிறது",
  "members.expiring.daysLeft.one": "{count} நாள் உள்ளது",
  "members.expiring.daysLeft.many": "{count} நாட்கள் உள்ளன",
  "members.expiring.recordDues": "கட்டணத்தைப் பதிவு செய்",
  "members.previewNote": "கட்டணங்களை அதிகாரிகள் கிளப்பின் நிலையான ஆண்டுத் தொகைக்கு எதிராகப் பதிவு செய்கிறார்கள். புதுப்பித்தல் நினைவூட்டல்கள் செயலி அறிவிப்புகளையும் போலி அவுட்பாக்ஸ் வரிசைகளையும் உருவாக்கும்; மின்னஞ்சல் அனுப்பப்படாது.",

  // Add member panel
  "members.add.title": "உறுப்பினரைச் சேர்",
  "members.add.description": "உள்நுழைவு அல்லது கட்டணம் இல்லாமல் ஒரு கிளப் பதிவை உருவாக்கும். உறுப்பினர் நிலையைச் செயல்படுத்த கட்டணத்தைத் தனியாகப் பதிவு செய்யவும்.",
  "members.add.fullName": "முழுப் பெயர்",
  "members.add.namePlaceholder": "ஆஷா டெமோ",
  "members.add.emailPlaceholder": "asha@example.com",
  "members.add.submit": "அடைவில் சேர்",
  "members.add.nameError": "உறுப்பினரின் பெயரை உள்ளிடவும் (2–120 எழுத்துகள்).",
  "members.add.emailError": "சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்.",
  "members.add.duplicate": "இந்த மின்னஞ்சலுடன் ஒரு உறுப்பினர் ஏற்கனவே உள்ளார்.",
  "members.add.failed": "உறுப்பினரைச் சேர்க்க முடியவில்லை.",

  // Reminders panel
  "members.reminders.title": "புதுப்பித்தல் நினைவூட்டல்களை அனுப்பு",
  "members.reminders.description": "இந்தக் காலத்திற்குள் உறுப்பினர் நிலை காலாவதியாகும் ஒவ்வொரு உறுப்பினருக்கும் ஒரு செயலி அறிவிப்பும் ஒரு போலி அவுட்பாக்ஸ் வரிசையும். மீண்டும் இயக்கினால் அதே காலாவதிக்கு ஏற்கனவே நினைவூட்டப்பட்டவர்கள் தவிர்க்கப்படுவார்கள்.",
  "members.reminders.window": "காலம் (நாட்கள்)",
  "members.reminders.windowError": "1 முதல் 365 வரை முழு எண்ணில் நாட்களை உள்ளிடவும்.",
  "members.reminders.result": "அடுத்த {days} நாட்களுக்கு நினைவூட்டல்கள் இயக்கப்பட்டன: {candidates} தகுதியானவர்கள், {sent} அனுப்பப்பட்டன, {skipped} ஏற்கனவே நினைவூட்டப்பட்டவர்கள். விநியோகம் போலியானது; மின்னஞ்சல் எதுவும் வெளியே செல்லாது.",
  "members.reminders.failed": "நினைவூட்டல்களை அனுப்ப முடியவில்லை.",

  // Detail page
  "members.detail.title": "உறுப்பினர்",
  "members.detail.officerOnly.title": "அதிகாரிகளுக்கு மட்டுமான பக்கம்",
  "members.detail.officerOnly.body": "உறுப்பினர் பதிவுகள் ஏற்பாட்டாளர்கள், பொருளாளர்கள், நிர்வாகிகளுக்குத் தெரியும்.",
  "members.detail.notFound": "உறுப்பினர் கிடைக்கவில்லை",
  "members.detail.notFoundTitle": "இந்தக் கிளப்பில் அப்படி ஒரு உறுப்பினர் இல்லை",
  "members.detail.notFoundBody": "இணைப்பு பழையதாக இருக்கலாம், அல்லது உறுப்பினர் வேறு கிளப்பைச் சேர்ந்தவராக இருக்கலாம்.",
  "members.detail.backToMembers": "உறுப்பினர்களுக்குத் திரும்பு",
  "members.detail.allMembers": "அனைத்து உறுப்பினர்களும்",
  "members.detail.profile.kicker": "உறுப்பினர் பதிவு",
  "members.detail.profile.title": "சுயவிவரம்",
  "members.detail.expiresOn": "காலாவதி தேதி",
  "members.detail.dues": "கட்டணம்",
  "members.detail.doorCode": "நுழைவுக் குறியீடு",
  "members.detail.accessKicker": "அணுகல்",
  "members.detail.accessTitle": "பங்கு மாற்றங்கள்",
  "members.detail.accessBody": "கிளப் தலைவர் மட்டுமே பங்குகளை மாற்றவோ கடவுச்சொற்களை அமைக்கவோ முடியும்.",
  "members.detail.previewNote": "பங்கு மாற்றங்களும் கடவுச்சொல் மீட்டமைப்புகளும் தணிக்கைப் பதிவில் எழுதப்படும். ஒரே குறிப்பு எண்ணை மீண்டும் பதிவு செய்தால் பாதுகாப்பாக அதே கட்டணம் திரும்பும்; இருமுறை வரவு வைக்கப்படாது.",

  // Dues history
  "members.history.kicker": "கட்டணப் பதிவேடு",
  "members.history.title": "கட்டண வரலாறு",
  "members.history.empty": "இன்னும் கட்டணம் பதிவு செய்யப்படவில்லை",
  "members.history.emptyBody": "முதல் கட்டணம் உறுப்பினர் நிலையை 365 நாட்களுக்குச் செயல்படுத்தும்.",
  "members.history.recorded": "பதிவு செய்யப்பட்டது",
  "members.history.expiry": "காலாவதி",
  "members.history.was": "முன்பு {date}",
  "members.history.first": "முதல் கட்டணம்",

  // Dues card
  "members.dues.title": "கட்டணப் பணத்தைப் பதிவு செய்",
  "members.dues.description": "தொகை கிளப்பின் நிலையான ஆண்டுக் கட்டணம். முதல் கட்டணம் உறுப்பினர் நிலையை 365 நாட்களுக்குச் செயல்படுத்தும்; புதுப்பித்தல், இன்று அல்லது தற்போதைய காலாவதியில் எது பிந்தையதோ அதனுடன் 365 நாட்களைச் சேர்க்கும். எனவே முன்கூட்டியே செலுத்தினால் நாட்கள் இழக்கப்படாது.",
  "members.dues.reference": "கட்டணக் குறிப்பு எண்",
  "members.dues.referencePlaceholder": "UPI / வங்கி / ரொக்க ரசீது குறிப்பு எண்",
  "members.dues.referenceError": "கட்டணக் குறிப்பு எண்ணை உள்ளிடவும் (குறைந்தது 3 எழுத்துகள்).",
  "members.dues.submit": "கட்டணத்தைப் பதிவு செய்",
  "members.dues.replayHint": "ஒரே குறிப்பு எண்ணை மீண்டும் பதிவு செய்வது பாதுகாப்பானது: அது அசல் கட்டணத்தைத் திருப்பித் தரும்.",
  "members.dues.recorded": "கட்டணம் பதிவு செய்யப்பட்டது. {name} இன் உறுப்பினர் நிலை இப்போது {date} வரை.",
  "members.dues.replayed": "குறிப்பு எண் \"{reference}\" ஏற்கனவே {name} க்குப் பதிவு செய்யப்பட்டது; மீண்டும் எதுவும் வரவு வைக்கப்படவில்லை. உறுப்பினர் நிலை {date} வரை.",

  // Role card
  "members.role.title": "பங்கு",
  "members.role.description": "பங்கு மாற்றங்கள் தணிக்கைப் பதிவில் எழுதப்படும்.",
  "members.role.self": "உங்கள் சொந்தப் பங்கை நீங்கள் மாற்ற முடியாது. வேறொரு நிர்வாகியிடம் கேட்கவும்.",
  "members.role.label": "கிளப் பங்கு",
  "members.role.submit": "பங்கை மாற்று",
  "members.role.pickDifferent": "முதலில் வேறு பங்கைத் தேர்ந்தெடுக்கவும்.",
  "members.role.changed": "{name} இப்போது {role}.",
  "members.role.ownRole": "உங்கள் சொந்தப் பங்கை நீங்கள் மாற்ற முடியாது.",
  "members.role.failed": "பங்கை மாற்ற முடியவில்லை.",

  // Password card
  "members.password.title": "கடவுச்சொல்லை அமை",
  "members.password.description": "இந்த உறுப்பினருக்கு உள்நுழைவு வழங்கும், அல்லது மறந்த கடவுச்சொல்லை மீட்டமைக்கும். இது தணிக்கை செய்யப்படும்.",
  "members.password.new": "புதிய கடவுச்சொல்",
  "members.password.confirm": "கடவுச்சொல்லை உறுதிப்படுத்து",
  "members.password.submit": "கடவுச்சொல்லை அமை",
  "members.password.lengthError": "8 முதல் 200 எழுத்துகளைப் பயன்படுத்தவும்.",
  "members.password.mismatch": "கடவுச்சொற்கள் பொருந்தவில்லை.",
  "members.password.done": "{name} க்குக் கடவுச்சொல் அமைக்கப்பட்டது. அதைத் தனிப்பட்ட முறையில் பகிரவும்; அவர்கள் அமைப்புகளில் அதை மாற்றலாம்.",
};

export default members;
