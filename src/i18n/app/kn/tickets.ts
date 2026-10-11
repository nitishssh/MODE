import type en from "../en/tickets";

const tickets: Record<keyof typeof en, string> = {
  "tickets.eyebrowYou": "ನೀವು",
  "tickets.eyebrow": "ಟಿಕೆಟ್‌ಗಳು",
  "tickets.title": "ನನ್ನ ಟಿಕೆಟ್‌ಗಳು",
  "tickets.description": "ಬುಕ್ ಮಾಡಿದ ಸೀಟು 30 ನಿಮಿಷ ಹೋಲ್ಡ್ ಆಗಿರುತ್ತದೆ. ಅಧಿಕಾರಿ ಡೆಸ್ಕ್‌ನಲ್ಲಿ ನಿಮ್ಮ ಪಾವತಿ ದೃಢೀಕರಿಸುತ್ತಾರೆ; ನಂತರ ನಿಮ್ಮ QR ಬಾಗಿಲಲ್ಲಿ ನಿಮಗೆ ಪ್ರವೇಶ ನೀಡುತ್ತದೆ.",
  "tickets.browse": "ಈವೆಂಟ್‌ಗಳನ್ನು ನೋಡಿ",
  "tickets.live": "ಸಕ್ರಿಯ ({count})",
  "tickets.past": "ಹಿಂದಿನ ({count})",
  "tickets.emptyLive": "ಸಕ್ರಿಯ ಟಿಕೆಟ್‌ಗಳಿಲ್ಲ",
  "tickets.emptyPast": "ಹಿಂದಿನ ಟಿಕೆಟ್‌ಗಳಿಲ್ಲ",
  "tickets.findEvent": "ಈವೆಂಟ್ ಹುಡುಕಿ",
  "tickets.emptyLiveBody": "ಈವೆಂಟ್‌ಗಳು ಪುಟದಿಂದ ಸೀಟು ಬುಕ್ ಮಾಡಿ.",
  "tickets.emptyPastBody": "ರದ್ದಾದ ಮತ್ತು ಅವಧಿ ಮುಗಿದ ಹೋಲ್ಡ್‌ಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.",
  "tickets.eventFallback": "ಈವೆಂಟ್",
  "tickets.eventTile": "ಈವೆಂಟ್",
  "tickets.detailsUnavailable": "ಈವೆಂಟ್ ವಿವರಗಳು ಲಭ್ಯವಿಲ್ಲ",
  "tickets.qrAlt": "ಟಿಕೆಟ್ QR. ಟೈಪ್ ಮಾಡುವ ಕೋಡ್ {code}",
  "tickets.rate": "{pricing} ದರ",
  "tickets.holdExpiresIn": "ಹೋಲ್ಡ್ ಮುಗಿಯಲು",
  "tickets.eventDetails": "ಈವೆಂಟ್ ವಿವರಗಳು",
  "tickets.note": "ಪಾವತಿಸಿದ ಟಿಕೆಟ್‌ಗಳನ್ನು ರದ್ದುಮಾಡಲಾಗದು: ಮರುಪಾವತಿ ವ್ಯಾಪ್ತಿಯಲ್ಲಿಲ್ಲ. ಪ್ರವೇಶದ್ವಾರದಲ್ಲಿ ಸ್ವಯಂಸೇವಕರಿಗೆ QR ತೋರಿಸಿ ಅಥವಾ ಡೋರ್ ಕೋಡ್ ಟೈಪ್ ಮಾಡಿ.",
};

export default tickets;
