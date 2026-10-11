import type en from "../en/members";

const members: Record<keyof typeof en, string> = {
  // Page
  "members.eyebrow.club": "ক্লাব",
  "members.eyebrow.section": "সদস্যসকল",
  "members.title": "সদস্যসকল",
  "members.description": "ক্লাবৰ সকলো, তেওঁলোকৰ ভূমিকা, আৰু সদস্যপদৰ অৱস্থা।",
  "members.officerOnly.title": "কেৱল পদাধিকাৰীৰ ডাইৰেক্টৰী",
  "members.officerOnly.body": "ইমেইল আৰু মাচুলসহ সদস্য ডাইৰেক্টৰী সংগঠক, কোষাধ্যক্ষ আৰু প্ৰশাসকে দেখে। আপোনাৰ নিজৰ পাছ মোৰ পাছ-ত আছে।",
  "members.runReminders": "ৰিমাইণ্ডাৰ চলাওক",
  "members.addMember": "সদস্য যোগ কৰক",
  "members.loadError": "ডাইৰেক্টৰী ল'ড কৰিব পৰা নগ'ল",
  "members.added": "{name}-ক ক্লাবত যোগ কৰা হ'ল।",

  // Metrics
  "members.metrics.label": "সদস্যপদৰ সংখ্যা",
  "members.metrics.total": "মুঠ সদস্য",
  "members.metrics.totalHint": "ক্লাব পঞ্জীত থকা সকলো",
  "members.metrics.active": "সক্ৰিয় সদস্যপদ",
  "members.metrics.activeHint": "{count} জনৰ ম্যাদ উকলিছে বা এতিয়াও যোগদান কৰা নাই",
  "members.metrics.loading": "ল'ড হৈ আছে",
  "members.metrics.expiring": "30 দিনত ম্যাদ শেষ",
  "members.metrics.expiringHint": "নবীকৰণৰ ৰিমাইণ্ডাৰ এই সদস্যসকলৰ ওচৰলৈ যায়",
  "members.metrics.officers": "পদাধিকাৰী",
  "members.metrics.officersHint": "স্বেচ্ছাসেৱক, সংগঠক, কোষাধ্যক্ষ আৰু মুৰব্বী",

  // Toolbar
  "members.search": "সদস্য সন্ধান কৰক",
  "members.searchPlaceholder": "নাম বা ইমেইলেৰে সন্ধান কৰক",
  "members.filterMembership": "সদস্যপদ অনুসৰি ফিল্টাৰ",
  "members.filterRole": "ভূমিকা অনুসৰি ফিল্টাৰ",
  "members.allMemberships": "সকলো সদস্যপদ",
  "members.allRoles": "সকলো ভূমিকা",
  "members.count.one": "{count} জন সদস্য",
  "members.count.many": "{count} জন সদস্য",

  // Directory
  "members.directory.kicker": "আপোনাৰ ক্লাবৰ প্ৰাণ",
  "members.directory.title": "সদস্য ডাইৰেক্টৰী",
  "members.directory.noMatches": "কোনো মিল নাই",
  "members.directory.noMatchesBody": "বেলেগ কিবা সন্ধান কৰক বা ফিল্টাৰ সলনি কৰক।",
  "members.directory.empty": "এতিয়াও কোনো সদস্য নাই",
  "members.directory.emptyBody": "আৰম্ভ কৰিবলৈ প্ৰথম সদস্য যোগ কৰক।",
  "members.col.dues": "সদস্যপদৰ মাচুল",
  "members.membershipExpired": "সদস্যপদৰ ম্যাদ উকলিল",
  "members.notYetJoined": "এতিয়াও যোগদান কৰা নাই",

  // Expiring card
  "members.expiring.kicker": "নবীকৰণ বাকী",
  "members.expiring.title": "30 দিনৰ ভিতৰত ম্যাদ শেষ",
  "members.expiring.none": "অহা 30 দিনত কোনো সদস্যপদৰ ম্যাদ শেষ হোৱা নাই।",
  "members.expiring.today": "আজি ম্যাদ শেষ",
  "members.expiring.daysLeft.one": "{count} দিন বাকী",
  "members.expiring.daysLeft.many": "{count} দিন বাকী",
  "members.expiring.recordDues": "মাচুল লিপিবদ্ধ কৰক",
  "members.previewNote": "পদাধিকাৰীসকলে ক্লাবৰ নিৰ্দিষ্ট বাৰ্ষিক পৰিমাণত মাচুল লিপিবদ্ধ কৰে। নবীকৰণৰ ৰিমাইণ্ডাৰে এপৰ ভিতৰত জাননী আৰু ছিমুলেটেড আউটবক্স শাৰী সৃষ্টি কৰে; কোনো ইমেইল পঠোৱা নহয়।",

  // Add member panel
  "members.add.title": "এজন সদস্য যোগ কৰক",
  "members.add.description": "লগইন বা পৰিশোধ অবিহনে এটা ক্লাব ৰেকৰ্ড সৃষ্টি কৰে। সদস্যপদ সক্ৰিয় কৰিবলৈ মাচুল পৃথকে লিপিবদ্ধ কৰক।",
  "members.add.fullName": "সম্পূৰ্ণ নাম",
  "members.add.namePlaceholder": "আশা ডেমো",
  "members.add.emailPlaceholder": "asha@example.com",
  "members.add.submit": "ডাইৰেক্টৰীত যোগ কৰক",
  "members.add.nameError": "সদস্যৰ নাম লিখক (2–120 আখৰ)।",
  "members.add.emailError": "এটা বৈধ ইমেইল ঠিকনা লিখক।",
  "members.add.duplicate": "এই ইমেইলেৰে ইতিমধ্যে এজন সদস্য আছে।",
  "members.add.failed": "সদস্য যোগ কৰিব পৰা নগ'ল।",

  // Reminders panel
  "members.reminders.title": "নবীকৰণৰ ৰিমাইণ্ডাৰ চলাওক",
  "members.reminders.description": "যিসকলৰ সদস্যপদ এই সময়সীমাৰ ভিতৰত শেষ হ'ব, প্ৰতিজনৰ বাবে এপত এটা জাননী আৰু এটা ছিমুলেটেড আউটবক্স শাৰী। একে ম্যাদৰ বাবে ইতিমধ্যে ৰিমাইণ্ডাৰ পোৱা সদস্যক পুনৰ চলোৱাত বাদ দিয়া হয়।",
  "members.reminders.window": "সময়সীমা (দিন)",
  "members.reminders.windowError": "1-ৰ পৰা 365-ৰ ভিতৰত দিনৰ এটা পূৰ্ণ সংখ্যা লিখক।",
  "members.reminders.result": "অহা {days} দিনৰ বাবে ৰিমাইণ্ডাৰ চলোৱা হ'ল: {candidates} জন যোগ্য, {sent} জনলৈ পঠোৱা হ'ল, {skipped} জনে ইতিমধ্যে পাইছে। প্ৰেৰণ ছিমুলেটেড; কোনো ইমেইল ব্যৱস্থাৰ বাহিৰলৈ নাযায়।",
  "members.reminders.failed": "ৰিমাইণ্ডাৰ চলাব পৰা নগ'ল।",

  // Detail page
  "members.detail.title": "সদস্য",
  "members.detail.officerOnly.title": "কেৱল পদাধিকাৰীৰ পৃষ্ঠা",
  "members.detail.officerOnly.body": "সদস্য ৰেকৰ্ড সংগঠক, কোষাধ্যক্ষ আৰু প্ৰশাসকে দেখে।",
  "members.detail.notFound": "সদস্য পোৱা নগ'ল",
  "members.detail.notFoundTitle": "এই ক্লাবত এনে কোনো সদস্য নাই",
  "members.detail.notFoundBody": "লিংকটো হয়তো পুৰণি, নাইবা সদস্যজন আন ক্লাবৰ।",
  "members.detail.backToMembers": "সদস্যসকললৈ উভতি যাওক",
  "members.detail.allMembers": "সকলো সদস্য",
  "members.detail.profile.kicker": "সদস্য ৰেকৰ্ড",
  "members.detail.profile.title": "প্ৰ'ফাইল",
  "members.detail.expiresOn": "ম্যাদ শেষ",
  "members.detail.dues": "মাচুল",
  "members.detail.doorCode": "দুৱাৰ ক'ড",
  "members.detail.accessKicker": "প্ৰৱেশাধিকাৰ",
  "members.detail.accessTitle": "ভূমিকা সলনি",
  "members.detail.accessBody": "কেৱল ক্লাব মুৰব্বীয়ে ভূমিকা সলনি বা পাছৱৰ্ড নিৰ্ধাৰণ কৰিব পাৰে।",
  "members.detail.previewNote": "ভূমিকা সলনি আৰু পাছৱৰ্ড ৰিছেট অডিট ট্ৰেইলত লিখা হয়। একে ৰেফাৰেন্স আকৌ দিলে নিৰাপদে আগৰটো ঘূৰি আহে, কেতিয়াও দুবাৰ ক্ৰেডিট নহয়।",

  // Dues history
  "members.history.kicker": "পৰিশোধ পঞ্জী",
  "members.history.title": "মাচুলৰ ইতিহাস",
  "members.history.empty": "এতিয়াও কোনো মাচুল লিপিবদ্ধ হোৱা নাই",
  "members.history.emptyBody": "প্ৰথম পৰিশোধে সদস্যপদ 365 দিনৰ বাবে সক্ৰিয় কৰে।",
  "members.history.recorded": "লিপিবদ্ধ",
  "members.history.expiry": "ম্যাদ",
  "members.history.was": "আগতে আছিল {date}",
  "members.history.first": "প্ৰথম পৰিশোধ",

  // Dues card
  "members.dues.title": "মাচুল পৰিশোধ লিপিবদ্ধ কৰক",
  "members.dues.description": "পৰিমাণটো ক্লাবৰ নিৰ্দিষ্ট বাৰ্ষিক মাচুল। প্ৰথম পৰিশোধে সদস্যপদ 365 দিনৰ বাবে সক্ৰিয় কৰে; নবীকৰণে আজি বা বৰ্তমান ম্যাদৰ যিটো পিছত, তাৰ লগত 365 দিন যোগ কৰে, গতিকে আগতীয়াকৈ দিলে কোনো দিন নষ্ট নহয়।",
  "members.dues.reference": "পৰিশোধ ৰেফাৰেন্স",
  "members.dues.referencePlaceholder": "UPI / বেংক / নগদ ৰচিদৰ ৰেফাৰেন্স",
  "members.dues.referenceError": "পৰিশোধ ৰেফাৰেন্স লিখক (কমেও 3 আখৰ)।",
  "members.dues.submit": "পৰিশোধ লিপিবদ্ধ কৰক",
  "members.dues.replayHint": "একে ৰেফাৰেন্স আকৌ দিয়া নিৰাপদ: আগৰ পৰিশোধটোৱেই ঘূৰি আহে।",
  "members.dues.recorded": "মাচুল লিপিবদ্ধ হ'ল। {name}-ৰ সদস্যপদ এতিয়া {date} লৈকে।",
  "members.dues.replayed": "ৰেফাৰেন্স \"{reference}\" {name}-ৰ বাবে ইতিমধ্যে লিপিবদ্ধ আছিল; আকৌ একো ক্ৰেডিট হোৱা নাই। সদস্যপদ {date} লৈকে।",

  // Role card
  "members.role.title": "ভূমিকা",
  "members.role.description": "ভূমিকা সলনি অডিট ট্ৰেইলত লিখা হয়।",
  "members.role.self": "নিজৰ ভূমিকা নিজে সলনি কৰিব নোৱাৰি। আন এজন প্ৰশাসকক কওক।",
  "members.role.label": "ক্লাবত ভূমিকা",
  "members.role.submit": "ভূমিকা সলনি কৰক",
  "members.role.pickDifferent": "প্ৰথমে বেলেগ এটা ভূমিকা বাছক।",
  "members.role.changed": "{name} এতিয়া {role}।",
  "members.role.ownRole": "নিজৰ ভূমিকা নিজে সলনি কৰিব নোৱাৰি।",
  "members.role.failed": "ভূমিকা সলনি কৰিব পৰা নগ'ল।",

  // Password card
  "members.password.title": "পাছৱৰ্ড নিৰ্ধাৰণ কৰক",
  "members.password.description": "এই সদস্যক লগইন দিয়ে, বা পাহৰা পাছৱৰ্ড ৰিছেট কৰে। এইটো অডিট হয়।",
  "members.password.new": "নতুন পাছৱৰ্ড",
  "members.password.confirm": "পাছৱৰ্ড নিশ্চিত কৰক",
  "members.password.submit": "পাছৱৰ্ড নিৰ্ধাৰণ কৰক",
  "members.password.lengthError": "8-ৰ পৰা 200 আখৰ ব্যৱহাৰ কৰক।",
  "members.password.mismatch": "পাছৱৰ্ড দুটা মিলা নাই।",
  "members.password.done": "{name}-ৰ পাছৱৰ্ড নিৰ্ধাৰণ হ'ল। গোপনে জনাওক; তেওঁ ছেটিংছৰ পৰা সলনি কৰিব পাৰিব।",
};

export default members;
