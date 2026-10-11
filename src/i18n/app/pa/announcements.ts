import type en from "../en/announcements";

const announcements: Record<keyof typeof en, string> = {
  // Page
  "announcements.eyebrow.club": "ਕਲੱਬ",
  "announcements.eyebrow.section": "ਨੋਟਿਸ",
  "announcements.title": "ਐਲਾਨ",
  "announcements.description": "ਕਲੱਬ ਵੱਲੋਂ ਪ੍ਰਕਾਸ਼ਿਤ ਹਰ ਚੀਜ਼ ਦਾ ਤਾਰੀਖ-ਵਾਰ ਆਰਕਾਈਵ, ਨਵਾਂ ਪਹਿਲਾਂ।",
  "announcements.new": "ਨਵਾਂ ਐਲਾਨ",
  "announcements.loading": "ਨੋਟਿਸ ਬੋਰਡ ਖੁੱਲ੍ਹ ਰਿਹਾ ਹੈ…",
  "announcements.loadError": "ਨੋਟਿਸ ਬੋਰਡ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕਿਆ",
  "announcements.previewNote": "ਪ੍ਰਕਾਸ਼ਨ ਹਰ ਸਰਗਰਮ ਮੈਂਬਰ ਲਈ ਇੱਕ ਐਪ ਸੂਚਨਾ ਅਤੇ ਇੱਕ ਸਿਮੂਲੇਟਿਡ ਆਊਟਬਾਕਸ ਕਤਾਰ ਬਣਾਉਂਦਾ ਹੈ। ਕੋਈ ਈਮੇਲ ਜਾਂ WhatsApp ਨਹੀਂ ਭੇਜਿਆ ਜਾਂਦਾ।",

  // Publish result
  "announcements.result.published": "ਪ੍ਰਕਾਸ਼ਿਤ",
  "announcements.result.alreadyPublished": "ਪਹਿਲਾਂ ਹੀ ਪ੍ਰਕਾਸ਼ਿਤ",
  "announcements.result.reach.one": "“{title}” ਐਪ ਵਿੱਚ {count} ਸਰਗਰਮ ਮੈਂਬਰ ਤੱਕ ਪਹੁੰਚਿਆ। ਡਿਲੀਵਰੀ ਸਿਮੂਲੇਟਿਡ ਹੈ: ਕੋਈ ਈਮੇਲ ਜਾਂ WhatsApp ਨਹੀਂ ਭੇਜਿਆ ਜਾਂਦਾ।",
  "announcements.result.reach.many": "“{title}” ਐਪ ਵਿੱਚ {count} ਸਰਗਰਮ ਮੈਂਬਰਾਂ ਤੱਕ ਪਹੁੰਚਿਆ। ਡਿਲੀਵਰੀ ਸਿਮੂਲੇਟਿਡ ਹੈ: ਕੋਈ ਈਮੇਲ ਜਾਂ WhatsApp ਨਹੀਂ ਭੇਜਿਆ ਜਾਂਦਾ।",

  // Toolbar / archive
  "announcements.archive": "ਆਰਕਾਈਵ",
  "announcements.count.one": "{total} ਵਿੱਚੋਂ {visible} ਐਲਾਨ",
  "announcements.count.many": "{total} ਵਿੱਚੋਂ {visible} ਐਲਾਨ",
  "announcements.search": "ਐਲਾਨ ਖੋਜੋ",
  "announcements.read": "ਪੜ੍ਹੋ",
  "announcements.empty.noMatch": "ਕੋਈ ਮੇਲ ਖਾਂਦਾ ਐਲਾਨ ਨਹੀਂ",
  "announcements.empty.quiet": "ਨੋਟਿਸ ਬੋਰਡ ਸ਼ਾਂਤ ਹੈ",
  "announcements.empty.differentSearch": "ਕੋਈ ਹੋਰ ਖੋਜ ਅਜ਼ਮਾਓ।",
  "announcements.empty.publishFirst": "ਉੱਪਰਲੇ ਬਟਨ ਨਾਲ ਪਹਿਲਾ ਐਲਾਨ ਪ੍ਰਕਾਸ਼ਿਤ ਕਰੋ।",
  "announcements.empty.none": "ਕਲੱਬ ਦੇ ਪ੍ਰਕਾਸ਼ਿਤ ਨੋਟਿਸ ਇੱਥੇ ਦਿਖਦੇ ਹਨ।",

  // Publish panel
  "announcements.publish.title": "ਇੱਕ ਐਲਾਨ ਪ੍ਰਕਾਸ਼ਿਤ ਕਰੋ",
  "announcements.publish.description": "ਪ੍ਰਕਾਸ਼ਨ ਤੁਰੰਤ ਹੁੰਦਾ ਹੈ ਅਤੇ ਹਰ ਸਰਗਰਮ ਮੈਂਬਰ ਲਈ ਇੱਕ ਸੂਚਨਾ ਬਣਾਉਂਦਾ ਹੈ। ਸੋਧਾਂ ਲਈ ਨਵਾਂ ਐਲਾਨ ਚਾਹੀਦਾ ਹੈ।",
  "announcements.publish.titleLabel": "ਸਿਰਲੇਖ",
  "announcements.publish.titlePlaceholder": "ਮੈਂਬਰਾਂ ਨੂੰ ਕੀ ਜਾਣਨ ਦੀ ਲੋੜ ਹੈ",
  "announcements.publish.message": "ਸੁਨੇਹਾ",
  "announcements.publish.messagePlaceholder": "ਸਾਦਾ ਟੈਕਸਟ",
  "announcements.publish.counter": "{count} / 10,000 ਅੱਖਰ। ਡਰਾਫਟ ਪ੍ਰਕਾਸ਼ਿਤ ਹੋਣ ਤੱਕ ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਰੱਖੇ ਜਾਂਦੇ ਹਨ।",
  "announcements.publish.titleError": "ਸਿਰਲੇਖ 3 ਤੋਂ 160 ਅੱਖਰ ਦਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ।",
  "announcements.publish.bodyError": "ਸਮੱਗਰੀ 1 ਤੋਂ 10,000 ਅੱਖਰ ਦੀ ਹੋਣੀ ਚਾਹੀਦੀ ਹੈ।",
  "announcements.publish.confirm": "ਹੁਣੇ ਪ੍ਰਕਾਸ਼ਿਤ ਕਰੀਏ? ਇਹ ਹਰ ਸਰਗਰਮ ਮੈਂਬਰ ਨੂੰ ਐਪ ਨੋਟਿਸ ਭੇਜਦਾ ਹੈ ਅਤੇ ਬਾਅਦ ਵਿੱਚ ਸੋਧਿਆ ਨਹੀਂ ਜਾ ਸਕਦਾ।",
  "announcements.publish.freshDraft": "ਨਵਾਂ ਡਰਾਫਟ ਸ਼ੁਰੂ ਕਰੋ",
  "announcements.publish.submit": "ਸਰਗਰਮ ਮੈਂਬਰਾਂ ਲਈ ਪ੍ਰਕਾਸ਼ਿਤ ਕਰੋ",
  "announcements.publish.publishing": "ਪ੍ਰਕਾਸ਼ਿਤ ਹੋ ਰਿਹਾ ਹੈ…",
  "announcements.publish.discard": "ਡਰਾਫਟ ਰੱਦ ਕਰੋ",

  // Detail page
  "announcements.detail.title": "ਐਲਾਨ",
  "announcements.detail.publishedAt": "ਪ੍ਰਕਾਸ਼ਿਤ {when}",
  "announcements.detail.all": "ਸਾਰੇ ਐਲਾਨ",
  "announcements.detail.loading": "ਨੋਟਿਸ ਖੁੱਲ੍ਹ ਰਿਹਾ ਹੈ…",
  "announcements.detail.unavailable": "ਐਲਾਨ ਉਪਲਬਧ ਨਹੀਂ",
  "announcements.detail.notFound": "ਇਹ ਐਲਾਨ ਨਹੀਂ ਮਿਲ ਸਕਿਆ।",

  // Outbox
  "announcements.outbox.kicker": "ਸਿਮੂਲੇਟਿਡ ਡਿਲੀਵਰੀ",
  "announcements.outbox.title": "ਆਊਟਬਾਕਸ",
  "announcements.outbox.reload": "ਮੁੜ ਲੋਡ ਕਰੋ",
  "announcements.outbox.footnote": "ਪ੍ਰਕਾਸ਼ਨ ਵੇਲੇ ਹਰ ਸਰਗਰਮ ਮੈਂਬਰ ਲਈ ਇੱਕ ਸਟੋਰ ਕੀਤੀ ਕਤਾਰ। ਕਤਾਰ ਸਾਬਤ ਕਰਦੀ ਹੈ ਕਿ ਕੀ ਦਰਜ ਹੋਇਆ, ਇਹ ਨਹੀਂ ਕਿ ਕੋਈ ਈਮੇਲ ਜਾਂ ਸੁਨੇਹਾ ਪਹੁੰਚਿਆ: ਬਾਹਰ ਕੁਝ ਨਹੀਂ ਭੇਜਿਆ ਜਾਂਦਾ।",
  "announcements.outbox.load": "ਪ੍ਰਾਪਤਕਰਤਾ ਲੋਡ ਕਰੋ",
  "announcements.outbox.loadError": "ਆਊਟਬਾਕਸ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕਿਆ।",
  "announcements.outbox.recipient": "ਪ੍ਰਾਪਤਕਰਤਾ",
  "announcements.outbox.subject": "ਵਿਸ਼ਾ",
  "announcements.outbox.recorded": "ਦਰਜ ਕੀਤਾ",
  "announcements.outbox.empty": "ਕੋਈ ਪ੍ਰਾਪਤਕਰਤਾ ਦਰਜ ਨਹੀਂ",
  "announcements.outbox.emptyBody": "ਜਦੋਂ ਇਹ ਪ੍ਰਕਾਸ਼ਿਤ ਹੋਇਆ, ਕਿਸੇ ਮੈਂਬਰ ਦੀ ਮੈਂਬਰਸ਼ਿਪ ਸਰਗਰਮ ਨਹੀਂ ਸੀ।",
};

export default announcements;
