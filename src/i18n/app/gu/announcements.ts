import type en from "../en/announcements";

const announcements: Record<keyof typeof en, string> = {
  // Page
  "announcements.eyebrow.club": "ક્લબ",
  "announcements.eyebrow.section": "નોટિસ",
  "announcements.title": "જાહેરાતો",
  "announcements.description": "ક્લબે પ્રકાશિત કરેલા બધાનું તારીખવાર આર્કાઇવ, સૌથી નવું પહેલાં.",
  "announcements.new": "નવી જાહેરાત",
  "announcements.loading": "નોટિસબોર્ડ ખુલી રહ્યું છે…",
  "announcements.loadError": "નોટિસબોર્ડ લોડ થઈ શક્યું નહીં",
  "announcements.previewNote": "પ્રકાશનથી દરેક સક્રિય સભ્ય માટે એપમાં એક સૂચના અને એક સિમ્યુલેટેડ આઉટબોક્સ એન્ટ્રી બને છે. કોઈ ઇમેઇલ કે WhatsApp મોકલાતો નથી.",

  // Publish result
  "announcements.result.published": "પ્રકાશિત",
  "announcements.result.alreadyPublished": "પહેલેથી પ્રકાશિત",
  "announcements.result.reach.one": "“{title}” એપમાં {count} સક્રિય સભ્ય સુધી પહોંચી. ડિલિવરી સિમ્યુલેટેડ છે: કોઈ ઇમેઇલ કે WhatsApp મોકલાતો નથી.",
  "announcements.result.reach.many": "“{title}” એપમાં {count} સક્રિય સભ્યો સુધી પહોંચી. ડિલિવરી સિમ્યુલેટેડ છે: કોઈ ઇમેઇલ કે WhatsApp મોકલાતો નથી.",

  // Toolbar / archive
  "announcements.archive": "આર્કાઇવ",
  "announcements.count.one": "{total} માંથી {visible} જાહેરાત",
  "announcements.count.many": "{total} માંથી {visible} જાહેરાતો",
  "announcements.search": "જાહેરાતો શોધો",
  "announcements.read": "વાંચો",
  "announcements.empty.noMatch": "મેળ ખાતી કોઈ જાહેરાત નથી",
  "announcements.empty.quiet": "નોટિસબોર્ડ શાંત છે",
  "announcements.empty.differentSearch": "બીજો શોધ શબ્દ અજમાવો.",
  "announcements.empty.publishFirst": "ઉપરના બટનથી પહેલી જાહેરાત પ્રકાશિત કરો.",
  "announcements.empty.none": "ક્લબની પ્રકાશિત નોટિસ અહીં દેખાય છે.",

  // Publish panel
  "announcements.publish.title": "જાહેરાત પ્રકાશિત કરો",
  "announcements.publish.description": "પ્રકાશન તરત થાય છે અને દરેક સક્રિય સભ્ય માટે એક સૂચના બનાવે છે. સુધારા માટે નવી જાહેરાત જોઈએ.",
  "announcements.publish.titleLabel": "શીર્ષક",
  "announcements.publish.titlePlaceholder": "સભ્યોએ શું જાણવું જોઈએ",
  "announcements.publish.message": "સંદેશ",
  "announcements.publish.messagePlaceholder": "સાદો ટેક્સ્ટ",
  "announcements.publish.counter": "{count} / 10,000 અક્ષર. પ્રકાશિત થાય ત્યાં સુધી ડ્રાફ્ટ આ બ્રાઉઝરમાં રહે છે.",
  "announcements.publish.titleError": "શીર્ષક 3 થી 160 અક્ષરનું હોવું જોઈએ.",
  "announcements.publish.bodyError": "સંદેશ 1 થી 10,000 અક્ષરનો હોવો જોઈએ.",
  "announcements.publish.confirm": "હમણાં પ્રકાશિત કરવું? આનાથી દરેક સક્રિય સભ્યને એપમાં નોટિસ જશે અને પછી સંપાદન થઈ શકશે નહીં.",
  "announcements.publish.freshDraft": "નવો ડ્રાફ્ટ શરૂ કરો",
  "announcements.publish.submit": "સક્રિય સભ્યો માટે પ્રકાશિત કરો",
  "announcements.publish.publishing": "પ્રકાશિત થઈ રહ્યું છે…",
  "announcements.publish.discard": "ડ્રાફ્ટ કાઢી નાખો",

  // Detail page
  "announcements.detail.title": "જાહેરાત",
  "announcements.detail.publishedAt": "{when} પ્રકાશિત",
  "announcements.detail.all": "બધી જાહેરાતો",
  "announcements.detail.loading": "નોટિસ ખુલી રહી છે…",
  "announcements.detail.unavailable": "જાહેરાત ઉપલબ્ધ નથી",
  "announcements.detail.notFound": "આ જાહેરાત મળી નહીં.",

  // Outbox
  "announcements.outbox.kicker": "સિમ્યુલેટેડ ડિલિવરી",
  "announcements.outbox.title": "આઉટબોક્સ",
  "announcements.outbox.reload": "ફરી લોડ કરો",
  "announcements.outbox.footnote": "પ્રકાશન સમયે દરેક સક્રિય સભ્ય માટે એક સંગ્રહિત એન્ટ્રી. એન્ટ્રી શું નોંધાયું તે સાબિત કરે છે, કોઈ ઇમેઇલ કે સંદેશ પહોંચ્યો તે નહીં: બહાર કંઈ મોકલાતું નથી.",
  "announcements.outbox.load": "પ્રાપ્તકર્તાઓ લોડ કરો",
  "announcements.outbox.loadError": "આઉટબોક્સ લોડ થઈ શક્યું નહીં.",
  "announcements.outbox.recipient": "પ્રાપ્તકર્તા",
  "announcements.outbox.subject": "વિષય",
  "announcements.outbox.recorded": "નોંધાયું",
  "announcements.outbox.empty": "કોઈ પ્રાપ્તકર્તા નોંધાયા નથી",
  "announcements.outbox.emptyBody": "આ પ્રકાશિત થયું ત્યારે કોઈ સભ્યનું સભ્યપદ સક્રિય નહોતું.",
};

export default announcements;
