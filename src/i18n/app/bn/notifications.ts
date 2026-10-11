import type en from "../en/notifications";

const notifications: Record<keyof typeof en, string> = {
  "notifications.kicker": "আপনি",
  "notifications.kickerSection": "বিজ্ঞপ্তি",
  "notifications.title": "বিজ্ঞপ্তি",
  "notifications.lede": "আপনাকে পাঠানো ঘোষণা ও চাঁদার রিমাইন্ডার।",
  "notifications.ledeUnread": "{count}টি অপঠিত। আপনাকে পাঠানো ঘোষণা ও চাঁদার রিমাইন্ডার।",
  "notifications.tabAll": "সব",
  "notifications.tabAnnouncements": "ঘোষণা",
  "notifications.tabDues": "চাঁদা",
  "notifications.emptyFilterTitle": "এই ফিল্টারে কিছু নেই",
  "notifications.emptyFilterBody": "অন্য ফিল্টার দেখুন।",
  "notifications.emptyTitle": "এখনও কোনো বিজ্ঞপ্তি নেই",
  "notifications.emptyBody": "প্রকাশিত ঘোষণা ও নবীকরণের রিমাইন্ডার এখানে দেখা যাবে।",
  "notifications.kind.announcement": "ঘোষণা",
  "notifications.kind.dues": "চাঁদা",
  "notifications.new": "নতুন",
  "notifications.readAnnouncement": "ঘোষণাটি পড়ুন",
  "notifications.previewNote": "বিজ্ঞপ্তি শুধু অ্যাপের ভিতরে। সংশ্লিষ্ট আউটবক্স সারি সিমুলেটেড; কোনো ইমেল বা WhatsApp পাঠানো হয় না।",
};

export default notifications;
