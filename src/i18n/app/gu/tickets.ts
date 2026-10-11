import type en from "../en/tickets";

const tickets: Record<keyof typeof en, string> = {
  "tickets.eyebrowYou": "તમે",
  "tickets.eyebrow": "ટિકિટો",
  "tickets.title": "મારી ટિકિટો",
  "tickets.description": "બુક કરેલી સીટ 30 મિનિટ માટે રખાય છે. અધિકારી ડેસ્ક પર તમારી ચુકવણીની પુષ્ટિ કરે છે; તે પછી તમારો QR દરવાજે પ્રવેશ અપાવે છે.",
  "tickets.browse": "ઇવેન્ટ્સ જુઓ",
  "tickets.live": "લાઇવ ({count})",
  "tickets.past": "પૂરી થયેલી ({count})",
  "tickets.emptyLive": "કોઈ લાઇવ ટિકિટ નથી",
  "tickets.emptyPast": "કોઈ જૂની ટિકિટ નથી",
  "tickets.findEvent": "ઇવેન્ટ શોધો",
  "tickets.emptyLiveBody": "ઇવેન્ટ્સ પેજ પરથી સીટ બુક કરો.",
  "tickets.emptyPastBody": "રદ અને સમાપ્ત હોલ્ડ અહીં દેખાય છે.",
  "tickets.eventFallback": "ઇવેન્ટ",
  "tickets.eventTile": "ઇવેન્ટ",
  "tickets.detailsUnavailable": "ઇવેન્ટની વિગતો ઉપલબ્ધ નથી",
  "tickets.qrAlt": "ટિકિટ QR. ટાઇપ કરવાનો કોડ {code}",
  "tickets.rate": "{pricing} દર",
  "tickets.holdExpiresIn": "હોલ્ડ સમાપ્ત થશે",
  "tickets.eventDetails": "ઇવેન્ટની વિગતો",
  "tickets.note": "ચૂકવેલી ટિકિટો રદ કરી શકાતી નથી: રિફંડ ઉપલબ્ધ નથી. પ્રવેશદ્વાર પર સ્વયંસેવકને QR બતાવો અથવા ડોર કોડ કહો.",
};

export default tickets;
