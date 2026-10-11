import type en from "../en/members";

const members: Record<keyof typeof en, string> = {
  // Page
  "members.eyebrow.club": "ક્લબ",
  "members.eyebrow.section": "સભ્યો",
  "members.title": "સભ્યો",
  "members.description": "ક્લબના બધા લોકો, તેમની ભૂમિકા અને તેમના સભ્યપદની સ્થિતિ.",
  "members.officerOnly.title": "ડિરેક્ટરી ફક્ત અધિકારીઓ માટે",
  "members.officerOnly.body": "ઇમેઇલ અને ફી સહિતની સભ્ય ડિરેક્ટરી આયોજકો, ખજાનચીઓ અને એડમિનને દેખાય છે. તમારો પોતાનો પાસ \"મારો પાસ\" માં છે.",
  "members.runReminders": "રિમાઇન્ડર મોકલો",
  "members.addMember": "સભ્ય ઉમેરો",
  "members.loadError": "ડિરેક્ટરી લોડ થઈ શકી નહીં",
  "members.added": "{name} ને ક્લબમાં ઉમેરાયા.",

  // Metrics
  "members.metrics.label": "સભ્યપદના આંકડા",
  "members.metrics.total": "કુલ સભ્યો",
  "members.metrics.totalHint": "ક્લબ રજિસ્ટરના બધા લોકો",
  "members.metrics.active": "સક્રિય સભ્યપદ",
  "members.metrics.activeHint": "{count} સમાપ્ત અથવા હજી જોડાયા નથી",
  "members.metrics.loading": "લોડ થઈ રહ્યું છે",
  "members.metrics.expiring": "30 દિવસમાં સમાપ્ત",
  "members.metrics.expiringHint": "નવીકરણ રિમાઇન્ડર આ સભ્યોને જાય છે",
  "members.metrics.officers": "અધિકારીઓ",
  "members.metrics.officersHint": "સ્વયંસેવકો, આયોજકો, ખજાનચીઓ અને વડા",

  // Toolbar
  "members.search": "સભ્યો શોધો",
  "members.searchPlaceholder": "નામ અથવા ઇમેઇલ શોધો",
  "members.filterMembership": "સભ્યપદ પ્રમાણે ફિલ્ટર કરો",
  "members.filterRole": "ભૂમિકા પ્રમાણે ફિલ્ટર કરો",
  "members.allMemberships": "બધાં સભ્યપદ",
  "members.allRoles": "બધી ભૂમિકાઓ",
  "members.count.one": "{count} સભ્ય",
  "members.count.many": "{count} સભ્યો",

  // Directory
  "members.directory.kicker": "તમારી ક્લબનું હૃદય",
  "members.directory.title": "સભ્ય ડિરેક્ટરી",
  "members.directory.noMatches": "કોઈ મેળ નથી",
  "members.directory.noMatchesBody": "બીજી શોધ અથવા ફિલ્ટર અજમાવો.",
  "members.directory.empty": "હજી કોઈ સભ્ય નથી",
  "members.directory.emptyBody": "શરૂ કરવા પહેલા સભ્યને ઉમેરો.",
  "members.col.dues": "સભ્યપદ ફી",
  "members.membershipExpired": "સભ્યપદ સમાપ્ત",
  "members.notYetJoined": "હજી જોડાયા નથી",

  // Expiring card
  "members.expiring.kicker": "નવીકરણ બાકી",
  "members.expiring.title": "30 દિવસની અંદર સમાપ્ત",
  "members.expiring.none": "આગામી 30 દિવસમાં કોઈ સભ્યપદ સમાપ્ત થતું નથી.",
  "members.expiring.today": "આજે સમાપ્ત",
  "members.expiring.daysLeft.one": "{count} દિવસ બાકી",
  "members.expiring.daysLeft.many": "{count} દિવસ બાકી",
  "members.expiring.recordDues": "ફી નોંધો",
  "members.previewNote": "ફી અધિકારીઓ ક્લબની નિશ્ચિત વાર્ષિક રકમ પ્રમાણે નોંધે છે. નવીકરણ રિમાઇન્ડર એપમાં સૂચનાઓ અને સિમ્યુલેટેડ આઉટબોક્સ એન્ટ્રીઓ બનાવે છે; કોઈ ઇમેઇલ મોકલાતો નથી.",

  // Add member panel
  "members.add.title": "સભ્ય ઉમેરો",
  "members.add.description": "લોગિન કે ચુકવણી વગર ક્લબ રેકોર્ડ બનાવે છે. સભ્યપદ સક્રિય કરવા ફી અલગથી નોંધો.",
  "members.add.fullName": "પૂરું નામ",
  "members.add.namePlaceholder": "આશા ડેમો",
  "members.add.emailPlaceholder": "asha@example.com",
  "members.add.submit": "ડિરેક્ટરીમાં ઉમેરો",
  "members.add.nameError": "સભ્યનું નામ દાખલ કરો (2–120 અક્ષર).",
  "members.add.emailError": "માન્ય ઇમેઇલ સરનામું દાખલ કરો.",
  "members.add.duplicate": "આ ઇમેઇલવાળા સભ્ય પહેલેથી અસ્તિત્વમાં છે.",
  "members.add.failed": "સભ્ય ઉમેરી શકાયા નહીં.",

  // Reminders panel
  "members.reminders.title": "નવીકરણ રિમાઇન્ડર મોકલો",
  "members.reminders.description": "જે સભ્યોનું સભ્યપદ આ સમયગાળામાં સમાપ્ત થાય છે, તે દરેકને એપમાં એક સૂચના અને એક સિમ્યુલેટેડ આઉટબોક્સ એન્ટ્રી. ફરી ચલાવતાં એ જ સમાપ્તિ માટે પહેલેથી યાદ કરાવેલા સભ્યો છોડી દેવાય છે.",
  "members.reminders.window": "સમયગાળો (દિવસ)",
  "members.reminders.windowError": "1 થી 365 વચ્ચે દિવસોની પૂર્ણ સંખ્યા દાખલ કરો.",
  "members.reminders.result": "આગામી {days} દિવસ માટે રિમાઇન્ડર મોકલાયા: {candidates} પાત્ર, {sent} મોકલાયા, {skipped} પહેલેથી યાદ કરાવેલા. ડિલિવરી સિમ્યુલેટેડ છે; સિસ્ટમમાંથી કોઈ ઇમેઇલ જતો નથી.",
  "members.reminders.failed": "રિમાઇન્ડર મોકલી શકાયા નહીં.",

  // Detail page
  "members.detail.title": "સભ્ય",
  "members.detail.officerOnly.title": "ફક્ત અધિકારીઓ માટેનું પેજ",
  "members.detail.officerOnly.body": "સભ્ય રેકોર્ડ આયોજકો, ખજાનચીઓ અને એડમિનને દેખાય છે.",
  "members.detail.notFound": "સભ્ય મળ્યા નહીં",
  "members.detail.notFoundTitle": "આ ક્લબમાં આવા કોઈ સભ્ય નથી",
  "members.detail.notFoundBody": "લિંક જૂની હશે, અથવા સભ્ય બીજી ક્લબના છે.",
  "members.detail.backToMembers": "સભ્યો પર પાછા",
  "members.detail.allMembers": "બધા સભ્યો",
  "members.detail.profile.kicker": "સભ્ય રેકોર્ડ",
  "members.detail.profile.title": "પ્રોફાઇલ",
  "members.detail.expiresOn": "સમાપ્તિ તારીખ",
  "members.detail.dues": "ફી",
  "members.detail.doorCode": "ડોર કોડ",
  "members.detail.accessKicker": "ઍક્સેસ",
  "members.detail.accessTitle": "ભૂમિકા ફેરફાર",
  "members.detail.accessBody": "ફક્ત ક્લબ વડા જ ભૂમિકા બદલી શકે છે અથવા પાસવર્ડ સેટ કરી શકે છે.",
  "members.detail.previewNote": "ભૂમિકા ફેરફાર અને પાસવર્ડ રીસેટ ઑડિટ ટ્રેલમાં નોંધાય છે. એ જ સંદર્ભ ફરી મોકલવો સુરક્ષિત છે અને ક્યારેય બે વાર જમા થતો નથી.",

  // Dues history
  "members.history.kicker": "ચુકવણી રજિસ્ટર",
  "members.history.title": "ફી ઇતિહાસ",
  "members.history.empty": "હજી કોઈ ફી નોંધાઈ નથી",
  "members.history.emptyBody": "પહેલી ચુકવણી સભ્યપદને 365 દિવસ માટે સક્રિય કરે છે.",
  "members.history.recorded": "નોંધાયું",
  "members.history.expiry": "સમાપ્તિ",
  "members.history.was": "પહેલાં {date} હતી",
  "members.history.first": "પહેલી ચુકવણી",

  // Dues card
  "members.dues.title": "ફી ચુકવણી નોંધો",
  "members.dues.description": "રકમ ક્લબની નિશ્ચિત વાર્ષિક ફી છે. પહેલી ચુકવણી સભ્યપદને 365 દિવસ માટે સક્રિય કરે છે; નવીકરણ આજ કે વર્તમાન સમાપ્તિ, જે પછીની હોય તેમાં 365 દિવસ ઉમેરે છે, તેથી વહેલા ચૂકવવાથી ક્યારેય દિવસ ગુમાવાતા નથી.",
  "members.dues.reference": "ચુકવણી સંદર્ભ",
  "members.dues.referencePlaceholder": "UPI / બૅંક / રોકડ રસીદ સંદર્ભ",
  "members.dues.referenceError": "ચુકવણી સંદર્ભ દાખલ કરો (ઓછામાં ઓછા 3 અક્ષર).",
  "members.dues.submit": "ચુકવણી નોંધો",
  "members.dues.replayHint": "એ જ સંદર્ભ ફરી મોકલવો સુરક્ષિત છે: મૂળ ચુકવણી જ પાછી અપાય છે.",
  "members.dues.recorded": "ફી નોંધાઈ. {name} નું સભ્યપદ હવે {date} સુધી છે.",
  "members.dues.replayed": "સંદર્ભ \"{reference}\" {name} માટે પહેલેથી નોંધાયેલો હતો; કંઈ ફરી જમા થયું નથી. સભ્યપદ {date} સુધી છે.",

  // Role card
  "members.role.title": "ભૂમિકા",
  "members.role.description": "ભૂમિકા ફેરફાર ઑડિટ ટ્રેલમાં નોંધાય છે.",
  "members.role.self": "તમે તમારી પોતાની ભૂમિકા બદલી શકતા નથી. બીજા એડમિનને કહો.",
  "members.role.label": "ક્લબ ભૂમિકા",
  "members.role.submit": "ભૂમિકા બદલો",
  "members.role.pickDifferent": "પહેલાં બીજી ભૂમિકા પસંદ કરો.",
  "members.role.changed": "{name} હવે {role} છે.",
  "members.role.ownRole": "તમે તમારી પોતાની ભૂમિકા બદલી શકતા નથી.",
  "members.role.failed": "ભૂમિકા બદલી શકાઈ નહીં.",

  // Password card
  "members.password.title": "પાસવર્ડ સેટ કરો",
  "members.password.description": "આ સભ્યને લોગિન આપે છે, અથવા ભૂલાયેલો પાસવર્ડ રીસેટ કરે છે. આ ઑડિટ થાય છે.",
  "members.password.new": "નવો પાસવર્ડ",
  "members.password.confirm": "પાસવર્ડની પુષ્ટિ કરો",
  "members.password.submit": "પાસવર્ડ સેટ કરો",
  "members.password.lengthError": "8 થી 200 અક્ષર વાપરો.",
  "members.password.mismatch": "પાસવર્ડ મેળ ખાતા નથી.",
  "members.password.done": "{name} માટે પાસવર્ડ સેટ થયો. તેને ખાનગી રીતે શેર કરો; તેઓ સેટિંગ્સમાંથી બદલી શકે છે.",
};

export default members;
