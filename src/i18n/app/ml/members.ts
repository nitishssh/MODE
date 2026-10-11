import type en from "../en/members";

const members: Record<keyof typeof en, string> = {
  // Page
  "members.eyebrow.club": "ക്ലബ്",
  "members.eyebrow.section": "അംഗങ്ങൾ",
  "members.title": "അംഗങ്ങൾ",
  "members.description": "ക്ലബ്ബിലെ എല്ലാവരും, അവരുടെ റോൾ, അംഗത്വത്തിന്റെ നില.",
  "members.officerOnly.title": "ഓഫീസർമാർക്ക് മാത്രമുള്ള ഡയറക്ടറി",
  "members.officerOnly.body": "ഇമെയിലും ഫീസും സഹിതമുള്ള അംഗ ഡയറക്ടറി ഓർഗനൈസർമാർക്കും ട്രഷറർമാർക്കും അഡ്മിൻമാർക്കും കാണാം. നിങ്ങളുടെ സ്വന്തം പാസ് 'എന്റെ പാസ്' എന്നതിലുണ്ട്.",
  "members.runReminders": "ഓർമ്മപ്പെടുത്തലുകൾ അയയ്ക്കുക",
  "members.addMember": "അംഗത്തെ ചേർക്കുക",
  "members.loadError": "ഡയറക്ടറി ലോഡ് ചെയ്യാനായില്ല",
  "members.added": "{name} ക്ലബ്ബിൽ ചേർക്കപ്പെട്ടു.",

  // Metrics
  "members.metrics.label": "അംഗത്വ കണക്കുകൾ",
  "members.metrics.total": "ആകെ അംഗങ്ങൾ",
  "members.metrics.totalHint": "ക്ലബ് രജിസ്റ്ററിലുള്ള എല്ലാവരും",
  "members.metrics.active": "സജീവ അംഗത്വം",
  "members.metrics.activeHint": "{count} കാലഹരണപ്പെട്ടവരോ ഇതുവരെ ചേരാത്തവരോ",
  "members.metrics.loading": "ലോഡ് ചെയ്യുന്നു",
  "members.metrics.expiring": "30 ദിവസത്തിനുള്ളിൽ കാലാവധി തീരുന്നവ",
  "members.metrics.expiringHint": "പുതുക്കൽ ഓർമ്മപ്പെടുത്തലുകൾ ഈ അംഗങ്ങൾക്ക് പോകും",
  "members.metrics.officers": "ഓഫീസർമാർ",
  "members.metrics.officersHint": "വോളണ്ടിയർമാർ, ഓർഗനൈസർമാർ, ട്രഷറർമാർ, ലീഡുകൾ",

  // Toolbar
  "members.search": "അംഗങ്ങളെ തിരയുക",
  "members.searchPlaceholder": "പേരോ ഇമെയിലോ തിരയുക",
  "members.filterMembership": "അംഗത്വം അനുസരിച്ച് ഫിൽട്ടർ ചെയ്യുക",
  "members.filterRole": "റോൾ അനുസരിച്ച് ഫിൽട്ടർ ചെയ്യുക",
  "members.allMemberships": "എല്ലാ അംഗത്വങ്ങളും",
  "members.allRoles": "എല്ലാ റോളുകളും",
  "members.count.one": "{count} അംഗം",
  "members.count.many": "{count} അംഗങ്ങൾ",

  // Directory
  "members.directory.kicker": "നിങ്ങളുടെ ക്ലബ്ബിന്റെ ഹൃദയം",
  "members.directory.title": "അംഗ ഡയറക്ടറി",
  "members.directory.noMatches": "പൊരുത്തങ്ങളില്ല",
  "members.directory.noMatchesBody": "മറ്റൊരു തിരയലോ ഫിൽട്ടറോ ശ്രമിക്കുക.",
  "members.directory.empty": "ഇതുവരെ അംഗങ്ങളില്ല",
  "members.directory.emptyBody": "തുടങ്ങാൻ ആദ്യത്തെ അംഗത്തെ ചേർക്കുക.",
  "members.col.dues": "അംഗത്വ ഫീസ്",
  "members.membershipExpired": "അംഗത്വം കാലഹരണപ്പെട്ടു",
  "members.notYetJoined": "ഇതുവരെ ചേർന്നിട്ടില്ല",

  // Expiring card
  "members.expiring.kicker": "പുതുക്കേണ്ടവ",
  "members.expiring.title": "30 ദിവസത്തിനുള്ളിൽ കാലാവധി തീരുന്നവ",
  "members.expiring.none": "അടുത്ത 30 ദിവസത്തിനുള്ളിൽ ഒരു അംഗത്വവും കാലഹരണപ്പെടുന്നില്ല.",
  "members.expiring.today": "ഇന്ന് കാലാവധി തീരും",
  "members.expiring.daysLeft.one": "{count} ദിവസം ബാക്കി",
  "members.expiring.daysLeft.many": "{count} ദിവസം ബാക്കി",
  "members.expiring.recordDues": "ഫീസ് രേഖപ്പെടുത്തുക",
  "members.previewNote": "ക്ലബ്ബിന്റെ നിശ്ചിത വാർഷിക തുകയ്ക്കെതിരെ ഓഫീസർമാരാണ് ഫീസ് രേഖപ്പെടുത്തുന്നത്. പുതുക്കൽ ഓർമ്മപ്പെടുത്തലുകൾ ആപ്പിനുള്ളിലെ നോട്ടീസുകളും സിമുലേറ്റഡ് ഔട്ട്ബോക്സ് വരികളും സൃഷ്ടിക്കുന്നു; ഇമെയിൽ അയയ്ക്കുന്നില്ല.",

  // Add member panel
  "members.add.title": "ഒരു അംഗത്തെ ചേർക്കുക",
  "members.add.description": "ലോഗിനോ പേയ്മെന്റോ ഇല്ലാതെ ഒരു ക്ലബ് രേഖ സൃഷ്ടിക്കുന്നു. അംഗത്വം സജീവമാക്കാൻ ഫീസ് പ്രത്യേകം രേഖപ്പെടുത്തുക.",
  "members.add.fullName": "മുഴുവൻ പേര്",
  "members.add.namePlaceholder": "Asha Demo",
  "members.add.emailPlaceholder": "asha@example.com",
  "members.add.submit": "ഡയറക്ടറിയിലേക്ക് ചേർക്കുക",
  "members.add.nameError": "അംഗത്തിന്റെ പേര് നൽകുക (2–120 അക്ഷരങ്ങൾ).",
  "members.add.emailError": "സാധുവായ ഇമെയിൽ വിലാസം നൽകുക.",
  "members.add.duplicate": "ഈ ഇമെയിലുള്ള ഒരു അംഗം ഇതിനകം ഉണ്ട്.",
  "members.add.failed": "അംഗത്തെ ചേർക്കാനായില്ല.",

  // Reminders panel
  "members.reminders.title": "പുതുക്കൽ ഓർമ്മപ്പെടുത്തലുകൾ അയയ്ക്കുക",
  "members.reminders.description": "നിശ്ചിത കാലയളവിനുള്ളിൽ അംഗത്വം കാലഹരണപ്പെടുന്ന ഓരോ അംഗത്തിനും ഒരു ആപ്പ് നോട്ടിഫിക്കേഷനും ഒരു സിമുലേറ്റഡ് ഔട്ട്ബോക്സ് വരിയും. വീണ്ടും പ്രവർത്തിപ്പിക്കുമ്പോൾ അതേ കാലാവധിക്ക് ഇതിനകം ഓർമ്മപ്പെടുത്തിയ അംഗങ്ങളെ ഒഴിവാക്കും.",
  "members.reminders.window": "കാലയളവ് (ദിവസങ്ങൾ)",
  "members.reminders.windowError": "1 മുതൽ 365 വരെയുള്ള ഒരു പൂർണ്ണസംഖ്യ നൽകുക.",
  "members.reminders.result": "അടുത്ത {days} ദിവസത്തേക്കുള്ള ഓർമ്മപ്പെടുത്തലുകൾ: {candidates} യോഗ്യർ, {sent} അയച്ചു, {skipped} ഇതിനകം ഓർമ്മപ്പെടുത്തി. ഡെലിവറി സിമുലേറ്റഡ് ആണ്; ഇമെയിൽ അയയ്ക്കുന്നില്ല.",
  "members.reminders.failed": "ഓർമ്മപ്പെടുത്തലുകൾ അയയ്ക്കാനായില്ല.",

  // Detail page
  "members.detail.title": "അംഗം",
  "members.detail.officerOnly.title": "ഓഫീസർമാർക്ക് മാത്രമുള്ള പേജ്",
  "members.detail.officerOnly.body": "അംഗ രേഖകൾ ഓർഗനൈസർമാർക്കും ട്രഷറർമാർക്കും അഡ്മിൻമാർക്കും കാണാം.",
  "members.detail.notFound": "അംഗത്തെ കണ്ടെത്തിയില്ല",
  "members.detail.notFoundTitle": "ഈ ക്ലബ്ബിൽ അങ്ങനെയൊരു അംഗമില്ല",
  "members.detail.notFoundBody": "ലിങ്ക് പഴയതാകാം, അല്ലെങ്കിൽ അംഗം മറ്റൊരു ക്ലബ്ബിലാകാം.",
  "members.detail.backToMembers": "അംഗങ്ങളിലേക്ക് മടങ്ങുക",
  "members.detail.allMembers": "എല്ലാ അംഗങ്ങളും",
  "members.detail.profile.kicker": "അംഗ രേഖ",
  "members.detail.profile.title": "പ്രൊഫൈൽ",
  "members.detail.expiresOn": "കാലാവധി തീരുന്നത്",
  "members.detail.dues": "ഫീസ്",
  "members.detail.doorCode": "ഡോർ കോഡ്",
  "members.detail.accessKicker": "ആക്സസ്",
  "members.detail.accessTitle": "റോൾ മാറ്റങ്ങൾ",
  "members.detail.accessBody": "ക്ലബ് ലീഡിന് മാത്രമേ റോളുകൾ മാറ്റാനോ പാസ്‌വേഡ് സജ്ജമാക്കാനോ കഴിയൂ.",
  "members.detail.previewNote": "റോൾ മാറ്റങ്ങളും പാസ്‌വേഡ് റീസെറ്റുകളും ഓഡിറ്റ് ട്രെയിലിൽ രേഖപ്പെടുത്തും. ഒരേ റഫറൻസ് വീണ്ടും നൽകിയാൽ ഫീസ് സുരക്ഷിതമായി ആവർത്തിക്കും; ഒരിക്കലും രണ്ടുതവണ ക്രെഡിറ്റ് ചെയ്യില്ല.",

  // Dues history
  "members.history.kicker": "പേയ്മെന്റ് രജിസ്റ്റർ",
  "members.history.title": "ഫീസ് ചരിത്രം",
  "members.history.empty": "ഇതുവരെ ഫീസ് രേഖപ്പെടുത്തിയിട്ടില്ല",
  "members.history.emptyBody": "ആദ്യ പേയ്മെന്റ് 365 ദിവസത്തേക്ക് അംഗത്വം സജീവമാക്കും.",
  "members.history.recorded": "രേഖപ്പെടുത്തിയത്",
  "members.history.expiry": "കാലാവധി",
  "members.history.was": "മുമ്പ് {date}",
  "members.history.first": "ആദ്യ പേയ്മെന്റ്",

  // Dues card
  "members.dues.title": "ഫീസ് പേയ്മെന്റ് രേഖപ്പെടുത്തുക",
  "members.dues.description": "തുക ക്ലബ്ബിന്റെ നിശ്ചിത വാർഷിക ഫീസാണ്. ആദ്യ പേയ്മെന്റ് 365 ദിവസത്തേക്ക് അംഗത്വം സജീവമാക്കും; പുതുക്കൽ ഇന്നത്തെയോ നിലവിലെ കാലാവധിയോ, ഏതാണോ വൈകിയത്, അതിനോട് 365 ദിവസം ചേർക്കും — അതിനാൽ നേരത്തേ അടച്ചാൽ ദിവസങ്ങൾ നഷ്ടപ്പെടില്ല.",
  "members.dues.reference": "പേയ്മെന്റ് റഫറൻസ്",
  "members.dues.referencePlaceholder": "UPI / ബാങ്ക് / പണ രസീത് റഫറൻസ്",
  "members.dues.referenceError": "പേയ്മെന്റ് റഫറൻസ് നൽകുക (കുറഞ്ഞത് 3 അക്ഷരങ്ങൾ).",
  "members.dues.submit": "പേയ്മെന്റ് രേഖപ്പെടുത്തുക",
  "members.dues.replayHint": "ഒരേ റഫറൻസ് വീണ്ടും നൽകുന്നത് സുരക്ഷിതമാണ്: യഥാർത്ഥ പേയ്മെന്റ് തന്നെ തിരികെ ലഭിക്കും.",
  "members.dues.recorded": "ഫീസ് രേഖപ്പെടുത്തി. {name}-ന്റെ അംഗത്വം ഇപ്പോൾ {date} വരെ.",
  "members.dues.replayed": "റഫറൻസ് \"{reference}\" {name}-ന് ഇതിനകം രേഖപ്പെടുത്തിയിരുന്നു; ഒന്നും വീണ്ടും ക്രെഡിറ്റ് ചെയ്തിട്ടില്ല. അംഗത്വം {date} വരെ.",

  // Role card
  "members.role.title": "റോൾ",
  "members.role.description": "റോൾ മാറ്റങ്ങൾ ഓഡിറ്റ് ട്രെയിലിൽ രേഖപ്പെടുത്തും.",
  "members.role.self": "സ്വന്തം റോൾ മാറ്റാനാകില്ല. മറ്റൊരു അഡ്മിനോട് ആവശ്യപ്പെടുക.",
  "members.role.label": "ക്ലബ് റോൾ",
  "members.role.submit": "റോൾ മാറ്റുക",
  "members.role.pickDifferent": "ആദ്യം മറ്റൊരു റോൾ തിരഞ്ഞെടുക്കുക.",
  "members.role.changed": "{name} ഇപ്പോൾ {role} ആണ്.",
  "members.role.ownRole": "സ്വന്തം റോൾ മാറ്റാനാകില്ല.",
  "members.role.failed": "റോൾ മാറ്റാനായില്ല.",

  // Password card
  "members.password.title": "പാസ്‌വേഡ് സജ്ജമാക്കുക",
  "members.password.description": "ഈ അംഗത്തിന് ഒരു ലോഗിൻ നൽകുന്നു, അല്ലെങ്കിൽ മറന്ന പാസ്‌വേഡ് റീസെറ്റ് ചെയ്യുന്നു. ഇത് ഓഡിറ്റ് ചെയ്യപ്പെടും.",
  "members.password.new": "പുതിയ പാസ്‌വേഡ്",
  "members.password.confirm": "പാസ്‌വേഡ് സ്ഥിരീകരിക്കുക",
  "members.password.submit": "പാസ്‌വേഡ് സജ്ജമാക്കുക",
  "members.password.lengthError": "8 മുതൽ 200 വരെ അക്ഷരങ്ങൾ ഉപയോഗിക്കുക.",
  "members.password.mismatch": "പാസ്‌വേഡുകൾ പൊരുത്തപ്പെടുന്നില്ല.",
  "members.password.done": "{name}-ന് പാസ്‌വേഡ് സജ്ജമാക്കി. സ്വകാര്യമായി പങ്കിടുക; അവർക്ക് ക്രമീകരണങ്ങളിൽ നിന്ന് മാറ്റാം.",
};

export default members;
