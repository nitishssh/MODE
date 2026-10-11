import type en from "../en/tickets";

const tickets: Record<keyof typeof en, string> = {
  "tickets.eyebrowYou": "तुम्ही",
  "tickets.eyebrow": "तिकिटे",
  "tickets.title": "माझी तिकिटे",
  "tickets.description": "बुक केलेली जागा 30 मिनिटे राखून ठेवली जाते. पदाधिकारी डेस्कवर तुमचे पेमेंट निश्चित करतो; त्यानंतर तुमचा QR दारावर प्रवेश देतो.",
  "tickets.browse": "कार्यक्रम पाहा",
  "tickets.live": "लाइव्ह ({count})",
  "tickets.past": "झालेली ({count})",
  "tickets.emptyLive": "लाइव्ह तिकिटे नाहीत",
  "tickets.emptyPast": "जुनी तिकिटे नाहीत",
  "tickets.findEvent": "कार्यक्रम शोधा",
  "tickets.emptyLiveBody": "कार्यक्रम पानावरून जागा बुक करा.",
  "tickets.emptyPastBody": "रद्द आणि संपलेले होल्ड इथे दिसतात.",
  "tickets.eventFallback": "कार्यक्रम",
  "tickets.eventTile": "कार्यक्रम",
  "tickets.detailsUnavailable": "कार्यक्रमाचा तपशील उपलब्ध नाही",
  "tickets.qrAlt": "तिकीट QR. टाइप करण्याचा कोड {code}",
  "tickets.rate": "{pricing} दर",
  "tickets.holdExpiresIn": "होल्ड संपतो",
  "tickets.eventDetails": "कार्यक्रमाचा तपशील",
  "tickets.note": "भरलेली तिकिटे रद्द करता येत नाहीत: परतावा उपलब्ध नाही. प्रवेशद्वारावर स्वयंसेवकाला QR दाखवा किंवा डोअर कोड सांगा.",
};

export default tickets;
