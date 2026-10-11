import type en from "../en/tickets";

const tickets: Record<keyof typeof en, string> = {
  "tickets.eyebrowYou": "మీరు",
  "tickets.eyebrow": "టికెట్లు",
  "tickets.title": "నా టికెట్లు",
  "tickets.description": "బుక్ చేసిన సీటు 30 నిమిషాల పాటు హోల్డ్ అవుతుంది. అధికారి డెస్క్ వద్ద మీ చెల్లింపును ధృవీకరిస్తారు; ఆ తర్వాత మీ QR డోర్ వద్ద మిమ్మల్ని లోపలికి అనుమతిస్తుంది.",
  "tickets.browse": "ఈవెంట్లు చూడండి",
  "tickets.live": "లైవ్ ({count})",
  "tickets.past": "గతం ({count})",
  "tickets.emptyLive": "లైవ్ టికెట్లు లేవు",
  "tickets.emptyPast": "గత టికెట్లు లేవు",
  "tickets.findEvent": "ఈవెంట్ కనుగొనండి",
  "tickets.emptyLiveBody": "ఈవెంట్లు పేజీ నుండి సీటు బుక్ చేయండి.",
  "tickets.emptyPastBody": "రద్దు చేసిన మరియు గడువు ముగిసిన హోల్డ్‌లు ఇక్కడ కనిపిస్తాయి.",
  "tickets.eventFallback": "ఈవెంట్",
  "tickets.eventTile": "ఈవెంట్",
  "tickets.detailsUnavailable": "ఈవెంట్ వివరాలు అందుబాటులో లేవు",
  "tickets.qrAlt": "టికెట్ QR. టైప్ చేసే కోడ్ {code}",
  "tickets.rate": "{pricing} ధర",
  "tickets.holdExpiresIn": "హోల్డ్ ముగిసేది",
  "tickets.eventDetails": "ఈవెంట్ వివరాలు",
  "tickets.note": "చెల్లించిన టికెట్లను రద్దు చేయలేం: రీఫండ్‌లు పరిధిలో లేవు. ప్రవేశద్వారం వద్ద వాలంటీర్‌కు QR చూపించండి లేదా డోర్ కోడ్ టైప్ చేయండి.",
};

export default tickets;
