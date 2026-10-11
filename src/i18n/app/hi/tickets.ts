import type en from "../en/tickets";

const tickets: Record<keyof typeof en, string> = {
  "tickets.eyebrowYou": "आप",
  "tickets.eyebrow": "टिकट",
  "tickets.title": "मेरे टिकट",
  "tickets.description": "बुक की गई सीट 30 मिनट तक होल्ड रहती है। पदाधिकारी डेस्क पर आपके भुगतान की पुष्टि करता है; उसके बाद आपका QR दरवाज़े पर प्रवेश दिलाता है।",
  "tickets.browse": "ईवेंट देखें",
  "tickets.live": "लाइव ({count})",
  "tickets.past": "बीते हुए ({count})",
  "tickets.emptyLive": "कोई लाइव टिकट नहीं",
  "tickets.emptyPast": "कोई पुराना टिकट नहीं",
  "tickets.findEvent": "ईवेंट ढूँढें",
  "tickets.emptyLiveBody": "ईवेंट पेज से सीट बुक करें।",
  "tickets.emptyPastBody": "रद्द और समाप्त होल्ड यहाँ दिखते हैं।",
  "tickets.eventFallback": "ईवेंट",
  "tickets.eventTile": "ईवेंट",
  "tickets.detailsUnavailable": "ईवेंट का विवरण उपलब्ध नहीं",
  "tickets.qrAlt": "टिकट QR। टाइप करने का कोड {code}",
  "tickets.rate": "{pricing} दर",
  "tickets.holdExpiresIn": "होल्ड समाप्त होगा",
  "tickets.eventDetails": "ईवेंट का विवरण",
  "tickets.note": "भुगतान किए गए टिकट रद्द नहीं हो सकते: रिफ़ंड की सुविधा नहीं है। प्रवेश द्वार पर वॉलंटियर को QR दिखाएँ या डोर कोड बताएँ।",
};

export default tickets;
