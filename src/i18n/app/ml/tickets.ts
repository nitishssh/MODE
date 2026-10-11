import type en from "../en/tickets";

const tickets: Record<keyof typeof en, string> = {
  "tickets.eyebrowYou": "നിങ്ങൾ",
  "tickets.eyebrow": "ടിക്കറ്റുകൾ",
  "tickets.title": "എന്റെ ടിക്കറ്റുകൾ",
  "tickets.description": "ബുക്ക് ചെയ്ത സീറ്റ് 30 മിനിറ്റ് ഹോൾഡ് ചെയ്യും. ഡെസ്കിൽ ഓഫീസർ പേയ്മെന്റ് സ്ഥിരീകരിക്കും; അതിനുശേഷം നിങ്ങളുടെ QR വാതിൽക്കൽ പ്രവേശനം നൽകും.",
  "tickets.browse": "ഇവന്റുകൾ കാണുക",
  "tickets.live": "സജീവം ({count})",
  "tickets.past": "കഴിഞ്ഞവ ({count})",
  "tickets.emptyLive": "സജീവ ടിക്കറ്റുകളില്ല",
  "tickets.emptyPast": "കഴിഞ്ഞ ടിക്കറ്റുകളില്ല",
  "tickets.findEvent": "ഒരു ഇവന്റ് കണ്ടെത്തുക",
  "tickets.emptyLiveBody": "ഇവന്റുകൾ പേജിൽ നിന്ന് സീറ്റ് ബുക്ക് ചെയ്യുക.",
  "tickets.emptyPastBody": "റദ്ദാക്കിയതും കാലഹരണപ്പെട്ടതുമായ ഹോൾഡുകൾ ഇവിടെ കാണാം.",
  "tickets.eventFallback": "ഇവന്റ്",
  "tickets.eventTile": "ഇവന്റ്",
  "tickets.detailsUnavailable": "ഇവന്റ് വിശദാംശങ്ങൾ ലഭ്യമല്ല",
  "tickets.qrAlt": "ടിക്കറ്റ് QR. ടൈപ്പ് ചെയ്യാനുള്ള കോഡ് {code}",
  "tickets.rate": "{pricing} നിരക്ക്",
  "tickets.holdExpiresIn": "ഹോൾഡ് അവസാനിക്കാൻ",
  "tickets.eventDetails": "ഇവന്റ് വിശദാംശങ്ങൾ",
  "tickets.note": "പണമടച്ച ടിക്കറ്റുകൾ റദ്ദാക്കാനാകില്ല: റീഫണ്ടുകൾ ഇതിന്റെ പരിധിയിലില്ല. പ്രവേശന കവാടത്തിലെ വോളണ്ടിയർക്ക് QR കാണിക്കുക അല്ലെങ്കിൽ ഡോർ കോഡ് പറയുക.",
};

export default tickets;
