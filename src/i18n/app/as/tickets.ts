import type en from "../en/tickets";

const tickets: Record<keyof typeof en, string> = {
  "tickets.eyebrowYou": "আপুনি",
  "tickets.eyebrow": "টিকট",
  "tickets.title": "মোৰ টিকট",
  "tickets.description": "বুক কৰা আসন 30 মিনিট ধৰি ৰখা হয়। ডেস্কত পদাধিকাৰীয়ে আপোনাৰ পৰিশোধ নিশ্চিত কৰে; তাৰ পিছত আপোনাৰ QR-এ দুৱাৰত প্ৰৱেশ কৰায়।",
  "tickets.browse": "অনুষ্ঠান চাওক",
  "tickets.live": "চলিত ({count})",
  "tickets.past": "অতীত ({count})",
  "tickets.emptyLive": "কোনো চলিত টিকট নাই",
  "tickets.emptyPast": "কোনো অতীত টিকট নাই",
  "tickets.findEvent": "অনুষ্ঠান বিচাৰক",
  "tickets.emptyLiveBody": "অনুষ্ঠান পৃষ্ঠাৰ পৰা এখন আসন বুক কৰক।",
  "tickets.emptyPastBody": "বাতিল আৰু ম্যাদ উকলা হ'ল্ড ইয়াত দেখা যায়।",
  "tickets.eventFallback": "অনুষ্ঠান",
  "tickets.eventTile": "অনুষ্ঠান",
  "tickets.detailsUnavailable": "অনুষ্ঠানৰ সবিশেষ উপলব্ধ নহয়",
  "tickets.qrAlt": "টিকট QR। টাইপ কৰিবলগীয়া ক'ড {code}",
  "tickets.rate": "{pricing} হাৰ",
  "tickets.holdExpiresIn": "হ'ল্ড শেষ হ'ব",
  "tickets.eventDetails": "অনুষ্ঠানৰ সবিশেষ",
  "tickets.note": "পৰিশোধিত টিকট বাতিল কৰিব নোৱাৰি: ৰিফাণ্ড এই ব্যৱস্থাৰ আওতাত নাই। প্ৰৱেশপথত স্বেচ্ছাসেৱকক QR দেখুৱাওক বা দুৱাৰ ক'ড কওক।",
};

export default tickets;
