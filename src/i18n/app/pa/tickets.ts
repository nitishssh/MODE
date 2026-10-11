import type en from "../en/tickets";

const tickets: Record<keyof typeof en, string> = {
  "tickets.eyebrowYou": "ਤੁਸੀਂ",
  "tickets.eyebrow": "ਟਿਕਟਾਂ",
  "tickets.title": "ਮੇਰੀਆਂ ਟਿਕਟਾਂ",
  "tickets.description": "ਬੁੱਕ ਕੀਤੀ ਸੀਟ 30 ਮਿੰਟ ਲਈ ਹੋਲਡ ਰਹਿੰਦੀ ਹੈ। ਅਧਿਕਾਰੀ ਡੈਸਕ 'ਤੇ ਤੁਹਾਡੇ ਭੁਗਤਾਨ ਦੀ ਪੁਸ਼ਟੀ ਕਰਦਾ ਹੈ; ਉਸ ਤੋਂ ਬਾਅਦ ਤੁਹਾਡਾ QR ਦਰਵਾਜ਼ੇ 'ਤੇ ਦਾਖਲਾ ਦਿੰਦਾ ਹੈ।",
  "tickets.browse": "ਇਵੈਂਟ ਵੇਖੋ",
  "tickets.live": "ਚਾਲੂ ({count})",
  "tickets.past": "ਪੁਰਾਣੀਆਂ ({count})",
  "tickets.emptyLive": "ਕੋਈ ਚਾਲੂ ਟਿਕਟ ਨਹੀਂ",
  "tickets.emptyPast": "ਕੋਈ ਪੁਰਾਣੀ ਟਿਕਟ ਨਹੀਂ",
  "tickets.findEvent": "ਇੱਕ ਇਵੈਂਟ ਲੱਭੋ",
  "tickets.emptyLiveBody": "ਇਵੈਂਟ ਪੰਨੇ ਤੋਂ ਸੀਟ ਬੁੱਕ ਕਰੋ।",
  "tickets.emptyPastBody": "ਰੱਦ ਅਤੇ ਮਿਆਦ ਖਤਮ ਹੋਲਡ ਇੱਥੇ ਦਿਖਦੇ ਹਨ।",
  "tickets.eventFallback": "ਇਵੈਂਟ",
  "tickets.eventTile": "ਇਵੈਂਟ",
  "tickets.detailsUnavailable": "ਇਵੈਂਟ ਵੇਰਵੇ ਉਪਲਬਧ ਨਹੀਂ",
  "tickets.qrAlt": "ਟਿਕਟ QR। ਟਾਈਪ ਕਰਨ ਵਾਲਾ ਕੋਡ {code}",
  "tickets.rate": "{pricing} ਦਰ",
  "tickets.holdExpiresIn": "ਹੋਲਡ ਖਤਮ ਹੋਣ ਵਿੱਚ",
  "tickets.eventDetails": "ਇਵੈਂਟ ਵੇਰਵੇ",
  "tickets.note": "ਭੁਗਤਾਨ ਕੀਤੀਆਂ ਟਿਕਟਾਂ ਰੱਦ ਨਹੀਂ ਹੋ ਸਕਦੀਆਂ: ਰਿਫੰਡ ਇਸ ਦੇ ਦਾਇਰੇ ਤੋਂ ਬਾਹਰ ਹਨ। ਦਾਖਲੇ 'ਤੇ ਵਲੰਟੀਅਰ ਨੂੰ QR ਵਿਖਾਓ ਜਾਂ ਡੋਰ ਕੋਡ ਦੱਸੋ।",
};

export default tickets;
