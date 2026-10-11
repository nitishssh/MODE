import type en from "../en/tickets";

const tickets: Record<keyof typeof en, string> = {
  "tickets.eyebrowYou": "আপনি",
  "tickets.eyebrow": "টিকিট",
  "tickets.title": "আমার টিকিট",
  "tickets.description": "বুক করা আসন 30 মিনিট ধরে রাখা হয়। ডেস্কে পদাধিকারী আপনার পেমেন্ট নিশ্চিত করেন; তারপর আপনার QR দরজায় প্রবেশ করায়।",
  "tickets.browse": "ইভেন্ট দেখুন",
  "tickets.live": "চালু ({count})",
  "tickets.past": "অতীত ({count})",
  "tickets.emptyLive": "কোনো চালু টিকিট নেই",
  "tickets.emptyPast": "কোনো অতীত টিকিট নেই",
  "tickets.findEvent": "ইভেন্ট খুঁজুন",
  "tickets.emptyLiveBody": "ইভেন্ট পেজ থেকে একটি আসন বুক করুন।",
  "tickets.emptyPastBody": "বাতিল ও মেয়াদোত্তীর্ণ হোল্ড এখানে দেখা যায়।",
  "tickets.eventFallback": "ইভেন্ট",
  "tickets.eventTile": "ইভেন্ট",
  "tickets.detailsUnavailable": "ইভেন্টের বিবরণ পাওয়া যাচ্ছে না",
  "tickets.qrAlt": "টিকিট QR। টাইপ করার কোড {code}",
  "tickets.rate": "{pricing} হার",
  "tickets.holdExpiresIn": "হোল্ড শেষ হবে",
  "tickets.eventDetails": "ইভেন্টের বিবরণ",
  "tickets.note": "পরিশোধিত টিকিট বাতিল করা যায় না: রিফান্ড এই ব্যবস্থার আওতায় নেই। প্রবেশপথে ভলান্টিয়ারকে QR দেখান বা ডোর কোড বলুন।",
};

export default tickets;
