import type en from "../en/announcements";

const announcements: Record<keyof typeof en, string> = {
  // Page
  "announcements.eyebrow.club": "ক্লাব",
  "announcements.eyebrow.section": "নোটিশ",
  "announcements.title": "ঘোষণা",
  "announcements.description": "ক্লাব যা কিছু প্রকাশ করেছে তার তারিখসহ আর্কাইভ, নতুনটি আগে।",
  "announcements.new": "নতুন ঘোষণা",
  "announcements.loading": "নোটিশবোর্ড খুলছে…",
  "announcements.loadError": "নোটিশবোর্ড লোড করা গেল না",
  "announcements.previewNote": "প্রকাশ করলে প্রতিটি সক্রিয় সদস্যের জন্য অ্যাপে একটি বিজ্ঞপ্তি ও একটি সিমুলেটেড আউটবক্স সারি তৈরি হয়। কোনো ইমেল বা WhatsApp পাঠানো হয় না।",

  // Publish result
  "announcements.result.published": "প্রকাশিত",
  "announcements.result.alreadyPublished": "আগেই প্রকাশিত",
  "announcements.result.reach.one": "“{title}” অ্যাপে {count} জন সক্রিয় সদস্যের কাছে পৌঁছেছে। পাঠানো সিমুলেটেড: কোনো ইমেল বা WhatsApp যায়নি।",
  "announcements.result.reach.many": "“{title}” অ্যাপে {count} জন সক্রিয় সদস্যের কাছে পৌঁছেছে। পাঠানো সিমুলেটেড: কোনো ইমেল বা WhatsApp যায়নি।",

  // Toolbar / archive
  "announcements.archive": "আর্কাইভ",
  "announcements.count.one": "{total}টির মধ্যে {visible}টি ঘোষণা",
  "announcements.count.many": "{total}টির মধ্যে {visible}টি ঘোষণা",
  "announcements.search": "ঘোষণা খুঁজুন",
  "announcements.read": "পড়ুন",
  "announcements.empty.noMatch": "মিলে যাওয়া কোনো ঘোষণা নেই",
  "announcements.empty.quiet": "নোটিশবোর্ড চুপচাপ",
  "announcements.empty.differentSearch": "অন্য কিছু খুঁজে দেখুন।",
  "announcements.empty.publishFirst": "উপরের বোতাম দিয়ে প্রথম ঘোষণা প্রকাশ করুন।",
  "announcements.empty.none": "ক্লাবের প্রকাশিত নোটিশ এখানে দেখা যায়।",

  // Publish panel
  "announcements.publish.title": "ঘোষণা প্রকাশ করুন",
  "announcements.publish.description": "প্রকাশ সঙ্গে সঙ্গে হয় এবং প্রতিটি সক্রিয় সদস্যের জন্য একটি বিজ্ঞপ্তি তৈরি করে। সংশোধনের জন্য নতুন ঘোষণা লাগবে।",
  "announcements.publish.titleLabel": "শিরোনাম",
  "announcements.publish.titlePlaceholder": "সদস্যদের যা জানা দরকার",
  "announcements.publish.message": "বার্তা",
  "announcements.publish.messagePlaceholder": "সাধারণ টেক্সট",
  "announcements.publish.counter": "{count} / 10,000 অক্ষর। প্রকাশের আগে পর্যন্ত খসড়া এই ব্রাউজারে থাকে।",
  "announcements.publish.titleError": "শিরোনাম 3 থেকে 160 অক্ষরের হতে হবে।",
  "announcements.publish.bodyError": "বার্তা 1 থেকে 10,000 অক্ষরের হতে হবে।",
  "announcements.publish.confirm": "এখনই প্রকাশ করবেন? এতে প্রতিটি সক্রিয় সদস্যের কাছে অ্যাপে নোটিশ যাবে এবং পরে সম্পাদনা করা যাবে না।",
  "announcements.publish.freshDraft": "নতুন খসড়া শুরু করুন",
  "announcements.publish.submit": "সক্রিয় সদস্যদের কাছে প্রকাশ করুন",
  "announcements.publish.publishing": "প্রকাশ হচ্ছে…",
  "announcements.publish.discard": "খসড়া ফেলে দিন",

  // Detail page
  "announcements.detail.title": "ঘোষণা",
  "announcements.detail.publishedAt": "প্রকাশিত {when}",
  "announcements.detail.all": "সব ঘোষণা",
  "announcements.detail.loading": "নোটিশ খুলছে…",
  "announcements.detail.unavailable": "ঘোষণা পাওয়া যাচ্ছে না",
  "announcements.detail.notFound": "এই ঘোষণাটি খুঁজে পাওয়া যায়নি।",

  // Outbox
  "announcements.outbox.kicker": "সিমুলেটেড পাঠানো",
  "announcements.outbox.title": "আউটবক্স",
  "announcements.outbox.reload": "আবার লোড করুন",
  "announcements.outbox.footnote": "প্রকাশের সময়ের প্রতিটি সক্রিয় সদস্যের জন্য একটি সংরক্ষিত সারি। সারিটি প্রমাণ করে কী নথিভুক্ত হয়েছে, কোনো ইমেল বা বার্তা পৌঁছেছে কি না তা নয়: বাইরে কিছুই পাঠানো হয় না।",
  "announcements.outbox.load": "প্রাপক লোড করুন",
  "announcements.outbox.loadError": "আউটবক্স লোড করা গেল না।",
  "announcements.outbox.recipient": "প্রাপক",
  "announcements.outbox.subject": "বিষয়",
  "announcements.outbox.recorded": "নথিভুক্ত",
  "announcements.outbox.empty": "কোনো প্রাপক নথিভুক্ত হয়নি",
  "announcements.outbox.emptyBody": "প্রকাশের সময় কোনো সদস্যের সক্রিয় সদস্যপদ ছিল না।",
};

export default announcements;
