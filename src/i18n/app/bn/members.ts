import type en from "../en/members";

const members: Record<keyof typeof en, string> = {
  // Page
  "members.eyebrow.club": "ক্লাব",
  "members.eyebrow.section": "সদস্য",
  "members.title": "সদস্য",
  "members.description": "ক্লাবের সবাই, তাঁদের ভূমিকা, আর সদস্যপদ কোথায় দাঁড়িয়ে।",
  "members.officerOnly.title": "শুধু পদাধিকারীদের ডিরেক্টরি",
  "members.officerOnly.body": "ইমেল ও চাঁদাসহ সদস্য ডিরেক্টরি আয়োজক, কোষাধ্যক্ষ ও অ্যাডমিনরা দেখতে পান। আপনার নিজের পাস আছে আমার পাস-এ।",
  "members.runReminders": "রিমাইন্ডার চালান",
  "members.addMember": "সদস্য যোগ করুন",
  "members.loadError": "ডিরেক্টরি লোড করা গেল না",
  "members.added": "{name}-কে ক্লাবে যোগ করা হয়েছে।",

  // Metrics
  "members.metrics.label": "সদস্যপদের সংখ্যা",
  "members.metrics.total": "মোট সদস্য",
  "members.metrics.totalHint": "ক্লাব রেজিস্টারে থাকা সবাই",
  "members.metrics.active": "সক্রিয় সদস্যপদ",
  "members.metrics.activeHint": "{count} জন মেয়াদোত্তীর্ণ বা এখনও যোগ দেননি",
  "members.metrics.loading": "লোড হচ্ছে",
  "members.metrics.expiring": "30 দিনে মেয়াদ শেষ",
  "members.metrics.expiringHint": "এই সদস্যদের কাছে নবীকরণের রিমাইন্ডার যায়",
  "members.metrics.officers": "পদাধিকারী",
  "members.metrics.officersHint": "ভলান্টিয়ার, আয়োজক, কোষাধ্যক্ষ ও প্রধান",

  // Toolbar
  "members.search": "সদস্য খুঁজুন",
  "members.searchPlaceholder": "নাম বা ইমেল দিয়ে খুঁজুন",
  "members.filterMembership": "সদস্যপদ অনুযায়ী ফিল্টার",
  "members.filterRole": "ভূমিকা অনুযায়ী ফিল্টার",
  "members.allMemberships": "সব সদস্যপদ",
  "members.allRoles": "সব ভূমিকা",
  "members.count.one": "{count} জন সদস্য",
  "members.count.many": "{count} জন সদস্য",

  // Directory
  "members.directory.kicker": "আপনার ক্লাবের প্রাণ",
  "members.directory.title": "সদস্য ডিরেক্টরি",
  "members.directory.noMatches": "কোনো মিল নেই",
  "members.directory.noMatchesBody": "অন্য কিছু খুঁজুন বা ফিল্টার বদলান।",
  "members.directory.empty": "এখনও কোনো সদস্য নেই",
  "members.directory.emptyBody": "শুরু করতে প্রথম সদস্য যোগ করুন।",
  "members.col.dues": "সদস্যপদ চাঁদা",
  "members.membershipExpired": "সদস্যপদের মেয়াদ শেষ",
  "members.notYetJoined": "এখনও যোগ দেননি",

  // Expiring card
  "members.expiring.kicker": "নবীকরণ বাকি",
  "members.expiring.title": "30 দিনের মধ্যে মেয়াদ শেষ",
  "members.expiring.none": "আগামী 30 দিনে কোনো সদস্যপদের মেয়াদ শেষ হচ্ছে না।",
  "members.expiring.today": "আজ মেয়াদ শেষ",
  "members.expiring.daysLeft.one": "{count} দিন বাকি",
  "members.expiring.daysLeft.many": "{count} দিন বাকি",
  "members.expiring.recordDues": "চাঁদা নথিভুক্ত করুন",
  "members.previewNote": "পদাধিকারীরা ক্লাবের নির্দিষ্ট বার্ষিক অঙ্কে চাঁদা নথিভুক্ত করেন। নবীকরণের রিমাইন্ডারে অ্যাপের ভিতরে নোটিশ ও সিমুলেটেড আউটবক্স সারি তৈরি হয়; কোনো ইমেল পাঠানো হয় না।",

  // Add member panel
  "members.add.title": "একজন সদস্য যোগ করুন",
  "members.add.description": "লগইন বা পেমেন্ট ছাড়াই একটি ক্লাব রেকর্ড তৈরি হয়। সদস্যপদ সক্রিয় করতে চাঁদা আলাদাভাবে নথিভুক্ত করুন।",
  "members.add.fullName": "পুরো নাম",
  "members.add.namePlaceholder": "আশা ডেমো",
  "members.add.emailPlaceholder": "asha@example.com",
  "members.add.submit": "ডিরেক্টরিতে যোগ করুন",
  "members.add.nameError": "সদস্যের নাম লিখুন (2–120 অক্ষর)।",
  "members.add.emailError": "একটি সঠিক ইমেল ঠিকানা লিখুন।",
  "members.add.duplicate": "এই ইমেলে ইতিমধ্যে একজন সদস্য আছেন।",
  "members.add.failed": "সদস্য যোগ করা গেল না।",

  // Reminders panel
  "members.reminders.title": "নবীকরণের রিমাইন্ডার চালান",
  "members.reminders.description": "যাঁদের সদস্যপদ এই সময়সীমার মধ্যে শেষ হচ্ছে, তাঁদের প্রত্যেককে অ্যাপে একটি বিজ্ঞপ্তি ও একটি সিমুলেটেড আউটবক্স সারি। একই মেয়াদের জন্য আগে রিমাইন্ডার পাওয়া সদস্যরা পরের বার বাদ যান।",
  "members.reminders.window": "সময়সীমা (দিন)",
  "members.reminders.windowError": "1 থেকে 365-এর মধ্যে একটি পূর্ণ সংখ্যা লিখুন।",
  "members.reminders.result": "আগামী {days} দিনের জন্য রিমাইন্ডার চালানো হয়েছে: {candidates} জন যোগ্য, {sent} জনকে পাঠানো হয়েছে, {skipped} জন আগেই রিমাইন্ডার পেয়েছেন। পাঠানো সিমুলেটেড; কোনো ইমেল সিস্টেমের বাইরে যায় না।",
  "members.reminders.failed": "রিমাইন্ডার চালানো গেল না।",

  // Detail page
  "members.detail.title": "সদস্য",
  "members.detail.officerOnly.title": "শুধু পদাধিকারীদের পেজ",
  "members.detail.officerOnly.body": "সদস্য রেকর্ড আয়োজক, কোষাধ্যক্ষ ও অ্যাডমিনরা দেখতে পান।",
  "members.detail.notFound": "সদস্য পাওয়া যায়নি",
  "members.detail.notFoundTitle": "এই ক্লাবে এমন কোনো সদস্য নেই",
  "members.detail.notFoundBody": "লিঙ্কটি হয়তো পুরোনো, অথবা সদস্যটি অন্য ক্লাবের।",
  "members.detail.backToMembers": "সদস্য তালিকায় ফিরে যান",
  "members.detail.allMembers": "সব সদস্য",
  "members.detail.profile.kicker": "সদস্য রেকর্ড",
  "members.detail.profile.title": "প্রোফাইল",
  "members.detail.expiresOn": "মেয়াদ শেষ",
  "members.detail.dues": "চাঁদা",
  "members.detail.doorCode": "ডোর কোড",
  "members.detail.accessKicker": "অ্যাক্সেস",
  "members.detail.accessTitle": "ভূমিকা পরিবর্তন",
  "members.detail.accessBody": "শুধু ক্লাব প্রধান ভূমিকা বদলাতে বা পাসওয়ার্ড সেট করতে পারেন।",
  "members.detail.previewNote": "ভূমিকা পরিবর্তন ও পাসওয়ার্ড রিসেট অডিট ট্রেইলে লেখা হয়। একই রেফারেন্স আবার দিলে নিরাপদে আগেরটি ফেরে, কখনও দু'বার ক্রেডিট হয় না।",

  // Dues history
  "members.history.kicker": "পেমেন্ট রেজিস্টার",
  "members.history.title": "চাঁদার ইতিহাস",
  "members.history.empty": "এখনও কোনো চাঁদা নথিভুক্ত হয়নি",
  "members.history.emptyBody": "প্রথম পেমেন্টে সদস্যপদ 365 দিনের জন্য সক্রিয় হয়।",
  "members.history.recorded": "নথিভুক্ত",
  "members.history.expiry": "মেয়াদ",
  "members.history.was": "আগে ছিল {date}",
  "members.history.first": "প্রথম পেমেন্ট",

  // Dues card
  "members.dues.title": "চাঁদার পেমেন্ট নথিভুক্ত করুন",
  "members.dues.description": "অঙ্কটি ক্লাবের নির্দিষ্ট বার্ষিক চাঁদা। প্রথম পেমেন্টে সদস্যপদ 365 দিনের জন্য সক্রিয় হয়; নবীকরণে আজ বা বর্তমান মেয়াদের মধ্যে যেটি পরে, তার সঙ্গে 365 দিন যোগ হয়, তাই আগে দিলে কোনো দিন নষ্ট হয় না।",
  "members.dues.reference": "পেমেন্ট রেফারেন্স",
  "members.dues.referencePlaceholder": "UPI / ব্যাঙ্ক / নগদ রসিদের রেফারেন্স",
  "members.dues.referenceError": "পেমেন্ট রেফারেন্স লিখুন (অন্তত 3 অক্ষর)।",
  "members.dues.submit": "পেমেন্ট নথিভুক্ত করুন",
  "members.dues.replayHint": "একই রেফারেন্স আবার দেওয়া নিরাপদ: আগের পেমেন্টটিই ফিরে আসে।",
  "members.dues.recorded": "চাঁদা নথিভুক্ত হয়েছে। {name}-এর সদস্যপদ এখন {date} পর্যন্ত।",
  "members.dues.replayed": "রেফারেন্স \"{reference}\" {name}-এর জন্য আগেই নথিভুক্ত ছিল; আবার কিছু ক্রেডিট হয়নি। সদস্যপদ {date} পর্যন্ত।",

  // Role card
  "members.role.title": "ভূমিকা",
  "members.role.description": "ভূমিকা পরিবর্তন অডিট ট্রেইলে লেখা হয়।",
  "members.role.self": "নিজের ভূমিকা নিজে বদলানো যায় না। অন্য অ্যাডমিনকে বলুন।",
  "members.role.label": "ক্লাবে ভূমিকা",
  "members.role.submit": "ভূমিকা বদলান",
  "members.role.pickDifferent": "আগে অন্য একটি ভূমিকা বেছে নিন।",
  "members.role.changed": "{name} এখন {role}।",
  "members.role.ownRole": "নিজের ভূমিকা নিজে বদলানো যায় না।",
  "members.role.failed": "ভূমিকা বদলানো গেল না।",

  // Password card
  "members.password.title": "পাসওয়ার্ড সেট করুন",
  "members.password.description": "এই সদস্যকে লগইন দেয়, বা ভুলে যাওয়া পাসওয়ার্ড রিসেট করে। এটি অডিট হয়।",
  "members.password.new": "নতুন পাসওয়ার্ড",
  "members.password.confirm": "পাসওয়ার্ড নিশ্চিত করুন",
  "members.password.submit": "পাসওয়ার্ড সেট করুন",
  "members.password.lengthError": "8 থেকে 200 অক্ষর ব্যবহার করুন।",
  "members.password.mismatch": "পাসওয়ার্ড দুটি মিলছে না।",
  "members.password.done": "{name}-এর পাসওয়ার্ড সেট হয়েছে। গোপনে জানিয়ে দিন; তিনি সেটিংস থেকে বদলাতে পারবেন।",
};

export default members;
