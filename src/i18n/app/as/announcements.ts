import type en from "../en/announcements";

const announcements: Record<keyof typeof en, string> = {
  // Page
  "announcements.eyebrow.club": "ক্লাব",
  "announcements.eyebrow.section": "জাননী",
  "announcements.title": "ঘোষণাসমূহ",
  "announcements.description": "ক্লাবে প্ৰকাশ কৰা সকলোৰে তাৰিখসহ আৰ্কাইভ, নতুনটো প্ৰথমে।",
  "announcements.new": "নতুন ঘোষণা",
  "announcements.loading": "জাননী ফলক খোল খাইছে…",
  "announcements.loadError": "জাননী ফলক ল'ড কৰিব পৰা নগ'ল",
  "announcements.previewNote": "প্ৰকাশ কৰিলে প্ৰতিজন সক্ৰিয় সদস্যৰ বাবে এপত এটা জাননী আৰু এটা ছিমুলেটেড আউটবক্স শাৰী সৃষ্টি হয়। কোনো ইমেইল বা WhatsApp পঠোৱা নহয়।",

  // Publish result
  "announcements.result.published": "প্ৰকাশিত",
  "announcements.result.alreadyPublished": "ইতিমধ্যে প্ৰকাশিত",
  "announcements.result.reach.one": "“{title}” এপত {count} জন সক্ৰিয় সদস্যৰ ওচৰ পালে। প্ৰেৰণ ছিমুলেটেড: কোনো ইমেইল বা WhatsApp পঠোৱা নহয়।",
  "announcements.result.reach.many": "“{title}” এপত {count} জন সক্ৰিয় সদস্যৰ ওচৰ পালে। প্ৰেৰণ ছিমুলেটেড: কোনো ইমেইল বা WhatsApp পঠোৱা নহয়।",

  // Toolbar / archive
  "announcements.archive": "আৰ্কাইভ",
  "announcements.count.one": "{total}টাৰ ভিতৰত {visible}টা ঘোষণা",
  "announcements.count.many": "{total}টাৰ ভিতৰত {visible}টা ঘোষণা",
  "announcements.search": "ঘোষণা সন্ধান কৰক",
  "announcements.read": "পঢ়ক",
  "announcements.empty.noMatch": "মিলা কোনো ঘোষণা নাই",
  "announcements.empty.quiet": "জাননী ফলক নিমাত",
  "announcements.empty.differentSearch": "বেলেগ কিবা সন্ধান কৰক।",
  "announcements.empty.publishFirst": "ওপৰৰ বুটামেৰে প্ৰথম ঘোষণা প্ৰকাশ কৰক।",
  "announcements.empty.none": "ক্লাবৰ প্ৰকাশিত জাননী ইয়াত দেখা যায়।",

  // Publish panel
  "announcements.publish.title": "ঘোষণা প্ৰকাশ কৰক",
  "announcements.publish.description": "প্ৰকাশ লগে লগে হয় আৰু প্ৰতিজন সক্ৰিয় সদস্যৰ বাবে এটা জাননী সৃষ্টি কৰে। শুধৰণিৰ বাবে নতুন ঘোষণা লাগিব।",
  "announcements.publish.titleLabel": "শিৰোনাম",
  "announcements.publish.titlePlaceholder": "সদস্যই জানিবলগীয়া কথা",
  "announcements.publish.message": "বাৰ্তা",
  "announcements.publish.messagePlaceholder": "সাধাৰণ টেক্সট",
  "announcements.publish.counter": "{count} / 10,000 আখৰ। প্ৰকাশ নকৰালৈকে খচৰা এই ব্ৰাউজাৰত থাকে।",
  "announcements.publish.titleError": "শিৰোনাম 3-ৰ পৰা 160 আখৰৰ হ'ব লাগিব।",
  "announcements.publish.bodyError": "বাৰ্তা 1-ৰ পৰা 10,000 আখৰৰ হ'ব লাগিব।",
  "announcements.publish.confirm": "এতিয়াই প্ৰকাশ কৰিবনে? ইয়াৰ ফলত প্ৰতিজন সক্ৰিয় সদস্যলৈ এপত জাননী যাব আৰু পিছত সম্পাদনা কৰিব নোৱাৰি।",
  "announcements.publish.freshDraft": "নতুন খচৰা আৰম্ভ কৰক",
  "announcements.publish.submit": "সক্ৰিয় সদস্যলৈ প্ৰকাশ কৰক",
  "announcements.publish.publishing": "প্ৰকাশ হৈ আছে…",
  "announcements.publish.discard": "খচৰা পেলাই দিয়ক",

  // Detail page
  "announcements.detail.title": "ঘোষণা",
  "announcements.detail.publishedAt": "প্ৰকাশিত {when}",
  "announcements.detail.all": "সকলো ঘোষণা",
  "announcements.detail.loading": "জাননী খোল খাইছে…",
  "announcements.detail.unavailable": "ঘোষণা উপলব্ধ নহয়",
  "announcements.detail.notFound": "এই ঘোষণাটো বিচাৰি পোৱা নগ'ল।",

  // Outbox
  "announcements.outbox.kicker": "ছিমুলেটেড প্ৰেৰণ",
  "announcements.outbox.title": "আউটবক্স",
  "announcements.outbox.reload": "আকৌ ল'ড কৰক",
  "announcements.outbox.footnote": "প্ৰকাশৰ সময়ৰ প্ৰতিজন সক্ৰিয় সদস্যৰ বাবে এটা সংৰক্ষিত শাৰী। শাৰীটোৱে কি লিপিবদ্ধ হ'ল তাক প্ৰমাণ কৰে, কোনো ইমেইল বা বাৰ্তা পালে নে নাই তাক নহয়: বাহিৰলৈ একো পঠোৱা নহয়।",
  "announcements.outbox.load": "প্ৰাপক ল'ড কৰক",
  "announcements.outbox.loadError": "আউটবক্স ল'ড কৰিব পৰা নগ'ল।",
  "announcements.outbox.recipient": "প্ৰাপক",
  "announcements.outbox.subject": "বিষয়",
  "announcements.outbox.recorded": "লিপিবদ্ধ",
  "announcements.outbox.empty": "কোনো প্ৰাপক লিপিবদ্ধ হোৱা নাই",
  "announcements.outbox.emptyBody": "প্ৰকাশৰ সময়ত কোনো সদস্যৰ সক্ৰিয় সদস্যপদ নাছিল।",
};

export default announcements;
