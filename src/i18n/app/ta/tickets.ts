import type en from "../en/tickets";

const tickets: Record<keyof typeof en, string> = {
  "tickets.eyebrowYou": "நீங்கள்",
  "tickets.eyebrow": "டிக்கெட்டுகள்",
  "tickets.title": "எனது டிக்கெட்டுகள்",
  "tickets.description": "முன்பதிவு செய்த இருக்கை 30 நிமிடங்களுக்கு ஒதுக்கப்படும். அதிகாரி மேசையில் உங்கள் கட்டணத்தை உறுதிப்படுத்துவார்; அதன் பிறகு உங்கள் QR நுழைவாயிலில் உங்களை அனுமதிக்கும்.",
  "tickets.browse": "நிகழ்வுகளைப் பார்",
  "tickets.live": "செயலில் ({count})",
  "tickets.past": "கடந்தவை ({count})",
  "tickets.emptyLive": "செயலில் உள்ள டிக்கெட்டுகள் இல்லை",
  "tickets.emptyPast": "கடந்த டிக்கெட்டுகள் இல்லை",
  "tickets.findEvent": "ஒரு நிகழ்வைக் கண்டறி",
  "tickets.emptyLiveBody": "நிகழ்வுகள் பக்கத்திலிருந்து ஒரு இருக்கையை முன்பதிவு செய்யவும்.",
  "tickets.emptyPastBody": "ரத்தான மற்றும் காலாவதியான ஒதுக்கீடுகள் இங்கே தோன்றும்.",
  "tickets.eventFallback": "நிகழ்வு",
  "tickets.eventTile": "நிகழ்வு",
  "tickets.detailsUnavailable": "நிகழ்வு விவரங்கள் கிடைக்கவில்லை",
  "tickets.qrAlt": "டிக்கெட் QR. தட்டச்சுக் குறியீடு {code}",
  "tickets.rate": "{pricing} விலை",
  "tickets.holdExpiresIn": "ஒதுக்கீடு முடிய",
  "tickets.eventDetails": "நிகழ்வு விவரங்கள்",
  "tickets.note": "செலுத்திய டிக்கெட்டுகளை ரத்து செய்ய முடியாது: பணத்திருப்பம் வரம்பிற்குள் இல்லை. நுழைவாயிலில் தன்னார்வலரிடம் QR ஐக் காட்டவும் அல்லது நுழைவுக் குறியீட்டைத் தட்டச்சு செய்யவும்.",
};

export default tickets;
