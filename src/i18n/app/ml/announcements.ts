import type en from "../en/announcements";

const announcements: Record<keyof typeof en, string> = {
  // Page
  "announcements.eyebrow.club": "ക്ലബ്",
  "announcements.eyebrow.section": "നോട്ടീസുകൾ",
  "announcements.title": "അറിയിപ്പുകൾ",
  "announcements.description": "ക്ലബ് പ്രസിദ്ധീകരിച്ച എല്ലാത്തിന്റെയും തീയതി ക്രമത്തിലുള്ള ആർക്കൈവ്, പുതിയത് ആദ്യം.",
  "announcements.new": "പുതിയ അറിയിപ്പ്",
  "announcements.loading": "നോട്ടീസ് ബോർഡ് തുറക്കുന്നു…",
  "announcements.loadError": "നോട്ടീസ് ബോർഡ് ലോഡ് ചെയ്യാനായില്ല",
  "announcements.previewNote": "പ്രസിദ്ധീകരണം ഓരോ സജീവ അംഗത്തിനും ഒരു ആപ്പ് നോട്ടിഫിക്കേഷനും ഒരു സിമുലേറ്റഡ് ഔട്ട്ബോക്സ് വരിയും സൃഷ്ടിക്കുന്നു. ഇമെയിലോ WhatsApp-ഓ അയയ്ക്കുന്നില്ല.",

  // Publish result
  "announcements.result.published": "പ്രസിദ്ധീകരിച്ചു",
  "announcements.result.alreadyPublished": "ഇതിനകം പ്രസിദ്ധീകരിച്ചു",
  "announcements.result.reach.one": "“{title}” ആപ്പിനുള്ളിൽ {count} സജീവ അംഗത്തിലേക്ക് എത്തി. ഡെലിവറി സിമുലേറ്റഡ് ആണ്: ഇമെയിലോ WhatsApp-ഓ അയയ്ക്കുന്നില്ല.",
  "announcements.result.reach.many": "“{title}” ആപ്പിനുള്ളിൽ {count} സജീവ അംഗങ്ങളിലേക്ക് എത്തി. ഡെലിവറി സിമുലേറ്റഡ് ആണ്: ഇമെയിലോ WhatsApp-ഓ അയയ്ക്കുന്നില്ല.",

  // Toolbar / archive
  "announcements.archive": "ആർക്കൈവ്",
  "announcements.count.one": "{total}-ൽ {visible} അറിയിപ്പ്",
  "announcements.count.many": "{total}-ൽ {visible} അറിയിപ്പുകൾ",
  "announcements.search": "അറിയിപ്പുകൾ തിരയുക",
  "announcements.read": "വായിക്കുക",
  "announcements.empty.noMatch": "പൊരുത്തപ്പെടുന്ന അറിയിപ്പുകളില്ല",
  "announcements.empty.quiet": "നോട്ടീസ് ബോർഡ് നിശ്ശബ്ദമാണ്",
  "announcements.empty.differentSearch": "മറ്റൊരു തിരയൽ ശ്രമിക്കുക.",
  "announcements.empty.publishFirst": "മുകളിലെ ബട്ടൺ ഉപയോഗിച്ച് ആദ്യത്തെ അറിയിപ്പ് പ്രസിദ്ധീകരിക്കുക.",
  "announcements.empty.none": "ക്ലബ് പ്രസിദ്ധീകരിച്ച നോട്ടീസുകൾ ഇവിടെ കാണാം.",

  // Publish panel
  "announcements.publish.title": "ഒരു അറിയിപ്പ് പ്രസിദ്ധീകരിക്കുക",
  "announcements.publish.description": "പ്രസിദ്ധീകരണം ഉടനടിയാണ്, ഓരോ സജീവ അംഗത്തിനും ഒരു നോട്ടിഫിക്കേഷൻ സൃഷ്ടിക്കും. തിരുത്തലുകൾക്ക് പുതിയ അറിയിപ്പ് വേണം.",
  "announcements.publish.titleLabel": "തലക്കെട്ട്",
  "announcements.publish.titlePlaceholder": "അംഗങ്ങൾ അറിയേണ്ടത്",
  "announcements.publish.message": "സന്ദേശം",
  "announcements.publish.messagePlaceholder": "സാധാരണ ടെക്സ്റ്റ്",
  "announcements.publish.counter": "{count} / 10,000 അക്ഷരങ്ങൾ. പ്രസിദ്ധീകരിക്കുന്നതുവരെ ഡ്രാഫ്റ്റുകൾ ഈ ബ്രൗസറിൽ സൂക്ഷിക്കും.",
  "announcements.publish.titleError": "തലക്കെട്ട് 3 മുതൽ 160 വരെ അക്ഷരങ്ങൾ ആയിരിക്കണം.",
  "announcements.publish.bodyError": "ഉള്ളടക്കം 1 മുതൽ 10,000 വരെ അക്ഷരങ്ങൾ ആയിരിക്കണം.",
  "announcements.publish.confirm": "ഇപ്പോൾ പ്രസിദ്ധീകരിക്കണോ? ഇത് എല്ലാ സജീവ അംഗങ്ങൾക്കും ആപ്പ് നോട്ടീസ് അയയ്ക്കും, പിന്നീട് എഡിറ്റ് ചെയ്യാനാകില്ല.",
  "announcements.publish.freshDraft": "പുതിയ ഡ്രാഫ്റ്റ് തുടങ്ങുക",
  "announcements.publish.submit": "സജീവ അംഗങ്ങൾക്ക് പ്രസിദ്ധീകരിക്കുക",
  "announcements.publish.publishing": "പ്രസിദ്ധീകരിക്കുന്നു…",
  "announcements.publish.discard": "ഡ്രാഫ്റ്റ് ഉപേക്ഷിക്കുക",

  // Detail page
  "announcements.detail.title": "അറിയിപ്പ്",
  "announcements.detail.publishedAt": "പ്രസിദ്ധീകരിച്ചത് {when}",
  "announcements.detail.all": "എല്ലാ അറിയിപ്പുകളും",
  "announcements.detail.loading": "നോട്ടീസ് തുറക്കുന്നു…",
  "announcements.detail.unavailable": "അറിയിപ്പ് ലഭ്യമല്ല",
  "announcements.detail.notFound": "ഈ അറിയിപ്പ് കണ്ടെത്താനായില്ല.",

  // Outbox
  "announcements.outbox.kicker": "സിമുലേറ്റഡ് ഡെലിവറി",
  "announcements.outbox.title": "ഔട്ട്ബോക്സ്",
  "announcements.outbox.reload": "വീണ്ടും ലോഡ് ചെയ്യുക",
  "announcements.outbox.footnote": "പ്രസിദ്ധീകരണ സമയത്തെ ഓരോ സജീവ അംഗത്തിനും ഒരു വരി. വരി എന്താണ് രേഖപ്പെടുത്തിയത് എന്ന് തെളിയിക്കുന്നു, ഇമെയിലോ സന്ദേശമോ ഡെലിവർ ചെയ്തു എന്നല്ല: പുറത്തേക്ക് ഒന്നും അയയ്ക്കുന്നില്ല.",
  "announcements.outbox.load": "സ്വീകർത്താക്കളെ ലോഡ് ചെയ്യുക",
  "announcements.outbox.loadError": "ഔട്ട്ബോക്സ് ലോഡ് ചെയ്യാനായില്ല.",
  "announcements.outbox.recipient": "സ്വീകർത്താവ്",
  "announcements.outbox.subject": "വിഷയം",
  "announcements.outbox.recorded": "രേഖപ്പെടുത്തിയത്",
  "announcements.outbox.empty": "സ്വീകർത്താക്കളെ രേഖപ്പെടുത്തിയിട്ടില്ല",
  "announcements.outbox.emptyBody": "ഇത് പ്രസിദ്ധീകരിച്ചപ്പോൾ ഒരു അംഗത്തിനും സജീവ അംഗത്വം ഉണ്ടായിരുന്നില്ല.",
};

export default announcements;
