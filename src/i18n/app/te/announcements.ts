import type en from "../en/announcements";

const announcements: Record<keyof typeof en, string> = {
  // Page
  "announcements.eyebrow.club": "క్లబ్",
  "announcements.eyebrow.section": "నోటీసులు",
  "announcements.title": "ప్రకటనలు",
  "announcements.description": "క్లబ్ ప్రచురించిన ప్రతిదాని తేదీవారీ ఆర్కైవ్, కొత్తవి ముందుగా.",
  "announcements.new": "కొత్త ప్రకటన",
  "announcements.loading": "నోటీసు బోర్డు తెరుస్తున్నాం…",
  "announcements.loadError": "నోటీసు బోర్డు లోడ్ కాలేదు",
  "announcements.previewNote": "ప్రచురణ ప్రతి యాక్టివ్ సభ్యుడికి ఒక యాప్ నోటిఫికేషన్ మరియు ఒక సిమ్యులేటెడ్ అవుట్‌బాక్స్ వరుసను సృష్టిస్తుంది. ఇమెయిల్ లేదా WhatsApp పంపబడదు.",

  // Publish result
  "announcements.result.published": "ప్రచురించబడింది",
  "announcements.result.alreadyPublished": "ఇప్పటికే ప్రచురించబడింది",
  "announcements.result.reach.one": "“{title}” యాప్‌లో {count} యాక్టివ్ సభ్యుడికి చేరింది. డెలివరీ సిమ్యులేటెడ్: ఇమెయిల్ లేదా WhatsApp పంపబడదు.",
  "announcements.result.reach.many": "“{title}” యాప్‌లో {count} యాక్టివ్ సభ్యులకు చేరింది. డెలివరీ సిమ్యులేటెడ్: ఇమెయిల్ లేదా WhatsApp పంపబడదు.",

  // Toolbar / archive
  "announcements.archive": "ఆర్కైవ్",
  "announcements.count.one": "{total}లో {visible} ప్రకటన",
  "announcements.count.many": "{total}లో {visible} ప్రకటనలు",
  "announcements.search": "ప్రకటనలు వెతకండి",
  "announcements.read": "చదవండి",
  "announcements.empty.noMatch": "సరిపోయే ప్రకటనలు లేవు",
  "announcements.empty.quiet": "నోటీసు బోర్డు నిశ్శబ్దంగా ఉంది",
  "announcements.empty.differentSearch": "వేరే పదంతో వెతికి చూడండి.",
  "announcements.empty.publishFirst": "పై బటన్‌తో మొదటి ప్రకటన ప్రచురించండి.",
  "announcements.empty.none": "క్లబ్ ప్రచురించిన నోటీసులు ఇక్కడ కనిపిస్తాయి.",

  // Publish panel
  "announcements.publish.title": "ప్రకటన ప్రచురించండి",
  "announcements.publish.description": "ప్రచురణ వెంటనే జరుగుతుంది మరియు ప్రతి యాక్టివ్ సభ్యుడికి ఒక నోటిఫికేషన్ సృష్టిస్తుంది. సవరణలకు కొత్త ప్రకటన అవసరం.",
  "announcements.publish.titleLabel": "శీర్షిక",
  "announcements.publish.titlePlaceholder": "సభ్యులు తెలుసుకోవాల్సింది",
  "announcements.publish.message": "సందేశం",
  "announcements.publish.messagePlaceholder": "సాదా టెక్స్ట్",
  "announcements.publish.counter": "{count} / 10,000 అక్షరాలు. ప్రచురించే వరకు డ్రాఫ్ట్‌లు ఈ బ్రౌజర్‌లో ఉంటాయి.",
  "announcements.publish.titleError": "శీర్షిక 3 నుండి 160 అక్షరాలు ఉండాలి.",
  "announcements.publish.bodyError": "సందేశం 1 నుండి 10,000 అక్షరాలు ఉండాలి.",
  "announcements.publish.confirm": "ఇప్పుడే ప్రచురించాలా? ఇది ప్రతి యాక్టివ్ సభ్యుడికి యాప్ నోటీసు పంపుతుంది మరియు తర్వాత సవరించలేరు.",
  "announcements.publish.freshDraft": "కొత్త డ్రాఫ్ట్ ప్రారంభించండి",
  "announcements.publish.submit": "యాక్టివ్ సభ్యులకు ప్రచురించు",
  "announcements.publish.publishing": "ప్రచురిస్తున్నాం…",
  "announcements.publish.discard": "డ్రాఫ్ట్ విస్మరించు",

  // Detail page
  "announcements.detail.title": "ప్రకటన",
  "announcements.detail.publishedAt": "{when} ప్రచురించబడింది",
  "announcements.detail.all": "అన్ని ప్రకటనలు",
  "announcements.detail.loading": "నోటీసు తెరుస్తున్నాం…",
  "announcements.detail.unavailable": "ప్రకటన అందుబాటులో లేదు",
  "announcements.detail.notFound": "ఈ ప్రకటన కనుగొనబడలేదు.",

  // Outbox
  "announcements.outbox.kicker": "సిమ్యులేటెడ్ డెలివరీ",
  "announcements.outbox.title": "అవుట్‌బాక్స్",
  "announcements.outbox.reload": "మళ్లీ లోడ్ చేయి",
  "announcements.outbox.footnote": "ప్రచురణ సమయంలో ప్రతి యాక్టివ్ సభ్యుడికి ఒక నిల్వ వరుస. వరుస ఏమి నమోదైందో నిరూపిస్తుంది, ఇమెయిల్ లేదా సందేశం డెలివరీ అయిందని కాదు: బయటకు ఏమీ పంపబడదు.",
  "announcements.outbox.load": "గ్రహీతలను లోడ్ చేయి",
  "announcements.outbox.loadError": "అవుట్‌బాక్స్ లోడ్ చేయలేకపోయాం.",
  "announcements.outbox.recipient": "గ్రహీత",
  "announcements.outbox.subject": "విషయం",
  "announcements.outbox.recorded": "నమోదైంది",
  "announcements.outbox.empty": "గ్రహీతలు నమోదు కాలేదు",
  "announcements.outbox.emptyBody": "ఇది ప్రచురించినప్పుడు ఏ సభ్యుడికీ యాక్టివ్ సభ్యత్వం లేదు.",
};

export default announcements;
