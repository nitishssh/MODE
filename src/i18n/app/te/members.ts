import type en from "../en/members";

const members: Record<keyof typeof en, string> = {
  // Page
  "members.eyebrow.club": "క్లబ్",
  "members.eyebrow.section": "సభ్యులు",
  "members.title": "సభ్యులు",
  "members.description": "క్లబ్‌లోని ప్రతి ఒక్కరూ, వారి పాత్ర, మరియు వారి సభ్యత్వ స్థితి.",
  "members.officerOnly.title": "అధికారులకు మాత్రమే డైరెక్టరీ",
  "members.officerOnly.body": "ఇమెయిల్‌లు మరియు రుసుములతో కూడిన సభ్యుల డైరెక్టరీ ఆర్గనైజర్లు, కోశాధికారులు మరియు అడ్మిన్‌లకు కనిపిస్తుంది. మీ సొంత పాస్ “నా పాస్” కింద ఉంది.",
  "members.runReminders": "రిమైండర్లు పంపండి",
  "members.addMember": "సభ్యుడిని జోడించు",
  "members.loadError": "డైరెక్టరీ లోడ్ కాలేదు",
  "members.added": "{name} క్లబ్‌కు జోడించబడ్డారు.",

  // Metrics
  "members.metrics.label": "సభ్యత్వ గణాంకాలు",
  "members.metrics.total": "మొత్తం సభ్యులు",
  "members.metrics.totalHint": "క్లబ్ రిజిస్టర్‌లోని ప్రతి ఒక్కరూ",
  "members.metrics.active": "యాక్టివ్ సభ్యత్వం",
  "members.metrics.activeHint": "{count} గడువు ముగిసినవి లేదా ఇంకా చేరనివి",
  "members.metrics.loading": "లోడ్ అవుతోంది",
  "members.metrics.expiring": "30 రోజుల్లో ముగుస్తున్నవి",
  "members.metrics.expiringHint": "పునరుద్ధరణ రిమైండర్లు ఈ సభ్యులకు వెళ్తాయి",
  "members.metrics.officers": "అధికారులు",
  "members.metrics.officersHint": "వాలంటీర్లు, ఆర్గనైజర్లు, కోశాధికారులు మరియు లీడ్‌లు",

  // Toolbar
  "members.search": "సభ్యులను వెతకండి",
  "members.searchPlaceholder": "పేరు లేదా ఇమెయిల్ వెతకండి",
  "members.filterMembership": "సభ్యత్వం ప్రకారం ఫిల్టర్ చేయండి",
  "members.filterRole": "పాత్ర ప్రకారం ఫిల్టర్ చేయండి",
  "members.allMemberships": "అన్ని సభ్యత్వాలు",
  "members.allRoles": "అన్ని పాత్రలు",
  "members.count.one": "{count} సభ్యుడు",
  "members.count.many": "{count} సభ్యులు",

  // Directory
  "members.directory.kicker": "మీ క్లబ్ గుండె",
  "members.directory.title": "సభ్యుల డైరెక్టరీ",
  "members.directory.noMatches": "సరిపోయేవి లేవు",
  "members.directory.noMatchesBody": "వేరే శోధన లేదా ఫిల్టర్ ప్రయత్నించండి.",
  "members.directory.empty": "ఇంకా సభ్యులు లేరు",
  "members.directory.emptyBody": "ప్రారంభించడానికి మొదటి సభ్యుడిని జోడించండి.",
  "members.col.dues": "సభ్యత్వ రుసుము",
  "members.membershipExpired": "సభ్యత్వ గడువు ముగిసింది",
  "members.notYetJoined": "ఇంకా చేరలేదు",

  // Expiring card
  "members.expiring.kicker": "పునరుద్ధరణలు పెండింగ్",
  "members.expiring.title": "30 రోజుల్లో ముగుస్తున్నవి",
  "members.expiring.none": "రాబోయే 30 రోజుల్లో ఏ సభ్యత్వాలూ ముగియవు.",
  "members.expiring.today": "ఈరోజు ముగుస్తుంది",
  "members.expiring.daysLeft.one": "{count} రోజు మిగిలింది",
  "members.expiring.daysLeft.many": "{count} రోజులు మిగిలాయి",
  "members.expiring.recordDues": "రుసుము నమోదు చేయండి",
  "members.previewNote": "రుసుమును అధికారులు క్లబ్ నిర్ణీత వార్షిక మొత్తం ప్రకారం నమోదు చేస్తారు. పునరుద్ధరణ రిమైండర్లు యాప్‌లో నోటీసులు మరియు సిమ్యులేటెడ్ అవుట్‌బాక్స్ వరుసలను సృష్టిస్తాయి; ఇమెయిల్ పంపబడదు.",

  // Add member panel
  "members.add.title": "సభ్యుడిని జోడించండి",
  "members.add.description": "లాగిన్ లేదా చెల్లింపు లేకుండా క్లబ్ రికార్డు సృష్టిస్తుంది. సభ్యత్వం యాక్టివేట్ చేయడానికి రుసుమును విడిగా నమోదు చేయండి.",
  "members.add.fullName": "పూర్తి పేరు",
  "members.add.namePlaceholder": "ఆశా డెమో",
  "members.add.emailPlaceholder": "asha@example.com",
  "members.add.submit": "డైరెక్టరీకి జోడించు",
  "members.add.nameError": "సభ్యుడి పేరు నమోదు చేయండి (2–120 అక్షరాలు).",
  "members.add.emailError": "చెల్లుబాటు అయ్యే ఇమెయిల్ చిరునామా నమోదు చేయండి.",
  "members.add.duplicate": "ఈ ఇమెయిల్‌తో సభ్యుడు ఇప్పటికే ఉన్నారు.",
  "members.add.failed": "సభ్యుడిని జోడించలేకపోయాం.",

  // Reminders panel
  "members.reminders.title": "పునరుద్ధరణ రిమైండర్లు పంపండి",
  "members.reminders.description": "ఈ వ్యవధిలో సభ్యత్వం ముగిసే ప్రతి సభ్యుడికి ఒక యాప్ నోటిఫికేషన్ మరియు ఒక సిమ్యులేటెడ్ అవుట్‌బాక్స్ వరుస. మళ్లీ రన్ చేస్తే అదే గడువుకు ఇప్పటికే రిమైండ్ చేసిన సభ్యులను దాటవేస్తుంది.",
  "members.reminders.window": "వ్యవధి (రోజులు)",
  "members.reminders.windowError": "1 నుండి 365 మధ్య పూర్ణ సంఖ్యలో రోజులు నమోదు చేయండి.",
  "members.reminders.result": "రాబోయే {days} రోజులకు రిమైండర్లు పంపబడ్డాయి: {candidates} అభ్యర్థులు, {sent} పంపబడ్డాయి, {skipped} ఇప్పటికే రిమైండ్ చేశారు. డెలివరీ సిమ్యులేటెడ్; సిస్టమ్ నుండి ఇమెయిల్ వెళ్లదు.",
  "members.reminders.failed": "రిమైండర్లు పంపలేకపోయాం.",

  // Detail page
  "members.detail.title": "సభ్యుడు",
  "members.detail.officerOnly.title": "అధికారులకు మాత్రమే పేజీ",
  "members.detail.officerOnly.body": "సభ్యుల రికార్డులు ఆర్గనైజర్లు, కోశాధికారులు మరియు అడ్మిన్‌లకు కనిపిస్తాయి.",
  "members.detail.notFound": "సభ్యుడు కనుగొనబడలేదు",
  "members.detail.notFoundTitle": "ఈ క్లబ్‌లో అలాంటి సభ్యుడు లేరు",
  "members.detail.notFoundBody": "లింక్ పాతది కావచ్చు, లేదా సభ్యుడు వేరే క్లబ్‌కు చెందినవారు కావచ్చు.",
  "members.detail.backToMembers": "సభ్యులకు తిరిగి వెళ్లండి",
  "members.detail.allMembers": "సభ్యులందరూ",
  "members.detail.profile.kicker": "సభ్యుడి రికార్డు",
  "members.detail.profile.title": "ప్రొఫైల్",
  "members.detail.expiresOn": "ముగిసే తేదీ",
  "members.detail.dues": "రుసుము",
  "members.detail.doorCode": "డోర్ కోడ్",
  "members.detail.accessKicker": "యాక్సెస్",
  "members.detail.accessTitle": "పాత్ర మార్పులు",
  "members.detail.accessBody": "క్లబ్ లీడ్ మాత్రమే పాత్రలు మార్చగలరు లేదా పాస్‌వర్డ్‌లు సెట్ చేయగలరు.",
  "members.detail.previewNote": "పాత్ర మార్పులు మరియు పాస్‌వర్డ్ రీసెట్‌లు ఆడిట్ ట్రైల్‌లో నమోదవుతాయి. అదే రిఫరెన్స్‌తో రుసుము మళ్లీ నమోదు చేస్తే సురక్షితంగా అదే చెల్లింపు తిరిగి వస్తుంది; రెండుసార్లు జమ కాదు.",

  // Dues history
  "members.history.kicker": "చెల్లింపు రిజిస్టర్",
  "members.history.title": "రుసుము చరిత్ర",
  "members.history.empty": "ఇంకా రుసుము నమోదు కాలేదు",
  "members.history.emptyBody": "మొదటి చెల్లింపు సభ్యత్వాన్ని 365 రోజులకు యాక్టివేట్ చేస్తుంది.",
  "members.history.recorded": "నమోదైంది",
  "members.history.expiry": "గడువు",
  "members.history.was": "ముందు {date}",
  "members.history.first": "మొదటి చెల్లింపు",

  // Dues card
  "members.dues.title": "రుసుము చెల్లింపు నమోదు చేయండి",
  "members.dues.description": "మొత్తం క్లబ్ నిర్ణీత వార్షిక రుసుము. మొదటి చెల్లింపు సభ్యత్వాన్ని 365 రోజులకు యాక్టివేట్ చేస్తుంది; పునరుద్ధరణ ఈరోజు లేదా ప్రస్తుత గడువులో ఏది తర్వాతో దానికి 365 రోజులు జోడిస్తుంది, కాబట్టి ముందుగా చెల్లిస్తే రోజులు పోవు.",
  "members.dues.reference": "చెల్లింపు రిఫరెన్స్",
  "members.dues.referencePlaceholder": "UPI / బ్యాంక్ / నగదు రసీదు రిఫరెన్స్",
  "members.dues.referenceError": "చెల్లింపు రిఫరెన్స్ నమోదు చేయండి (కనీసం 3 అక్షరాలు).",
  "members.dues.submit": "చెల్లింపు నమోదు చేయి",
  "members.dues.replayHint": "అదే రిఫరెన్స్ మళ్లీ నమోదు చేయడం సురక్షితం: అది అసలు చెల్లింపును తిరిగి ఇస్తుంది.",
  "members.dues.recorded": "రుసుము నమోదైంది. {name} సభ్యత్వం ఇప్పుడు {date} వరకు ఉంటుంది.",
  "members.dues.replayed": "రిఫరెన్స్ \"{reference}\" ఇప్పటికే {name} కోసం నమోదైంది; మళ్లీ ఏమీ జమ కాలేదు. సభ్యత్వం {date} వరకు ఉంటుంది.",

  // Role card
  "members.role.title": "పాత్ర",
  "members.role.description": "పాత్ర మార్పులు ఆడిట్ ట్రైల్‌లో నమోదవుతాయి.",
  "members.role.self": "మీ సొంత పాత్రను మీరు మార్చలేరు. మరో అడ్మిన్‌ను అడగండి.",
  "members.role.label": "క్లబ్ పాత్ర",
  "members.role.submit": "పాత్ర మార్చు",
  "members.role.pickDifferent": "ముందుగా వేరే పాత్రను ఎంచుకోండి.",
  "members.role.changed": "{name} ఇప్పుడు {role}.",
  "members.role.ownRole": "మీ సొంత పాత్రను మీరు మార్చలేరు.",
  "members.role.failed": "పాత్రను మార్చలేకపోయాం.",

  // Password card
  "members.password.title": "పాస్‌వర్డ్ సెట్ చేయండి",
  "members.password.description": "ఈ సభ్యుడికి లాగిన్ ఇస్తుంది, లేదా మర్చిపోయిన పాస్‌వర్డ్‌ను రీసెట్ చేస్తుంది. ఇది ఆడిట్ అవుతుంది.",
  "members.password.new": "కొత్త పాస్‌వర్డ్",
  "members.password.confirm": "పాస్‌వర్డ్ ధృవీకరించండి",
  "members.password.submit": "పాస్‌వర్డ్ సెట్ చేయి",
  "members.password.lengthError": "8 నుండి 200 అక్షరాలు ఉపయోగించండి.",
  "members.password.mismatch": "పాస్‌వర్డ్‌లు సరిపోలడం లేదు.",
  "members.password.done": "{name} కోసం పాస్‌వర్డ్ సెట్ అయింది. దీన్ని గోప్యంగా పంచుకోండి; వారు సెట్టింగ్‌ల నుండి మార్చుకోవచ్చు.",
};

export default members;
