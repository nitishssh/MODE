import type en from "../en/members";

const members: Record<keyof typeof en, string> = {
  // Page
  "members.eyebrow.club": "ਕਲੱਬ",
  "members.eyebrow.section": "ਮੈਂਬਰ",
  "members.title": "ਮੈਂਬਰ",
  "members.description": "ਕਲੱਬ ਦਾ ਹਰ ਕੋਈ, ਉਨ੍ਹਾਂ ਦੀ ਭੂਮਿਕਾ, ਅਤੇ ਉਨ੍ਹਾਂ ਦੀ ਮੈਂਬਰਸ਼ਿਪ ਦੀ ਸਥਿਤੀ।",
  "members.officerOnly.title": "ਸਿਰਫ਼ ਅਧਿਕਾਰੀਆਂ ਲਈ ਡਾਇਰੈਕਟਰੀ",
  "members.officerOnly.body": "ਈਮੇਲ ਅਤੇ ਫੀਸ ਸਮੇਤ ਮੈਂਬਰ ਡਾਇਰੈਕਟਰੀ ਆਯੋਜਕਾਂ, ਖਜ਼ਾਨਚੀਆਂ ਅਤੇ ਐਡਮਿਨਾਂ ਨੂੰ ਦਿਖਦੀ ਹੈ। ਤੁਹਾਡਾ ਆਪਣਾ ਪਾਸ 'ਮੇਰਾ ਪਾਸ' ਹੇਠ ਹੈ।",
  "members.runReminders": "ਯਾਦ-ਦਹਾਨੀਆਂ ਭੇਜੋ",
  "members.addMember": "ਮੈਂਬਰ ਜੋੜੋ",
  "members.loadError": "ਡਾਇਰੈਕਟਰੀ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ",
  "members.added": "{name} ਨੂੰ ਕਲੱਬ ਵਿੱਚ ਜੋੜ ਦਿੱਤਾ ਗਿਆ।",

  // Metrics
  "members.metrics.label": "ਮੈਂਬਰਸ਼ਿਪ ਅੰਕੜੇ",
  "members.metrics.total": "ਕੁੱਲ ਮੈਂਬਰ",
  "members.metrics.totalHint": "ਕਲੱਬ ਰਜਿਸਟਰ 'ਤੇ ਹਰ ਕੋਈ",
  "members.metrics.active": "ਸਰਗਰਮ ਮੈਂਬਰਸ਼ਿਪ",
  "members.metrics.activeHint": "{count} ਮਿਆਦ ਖਤਮ ਜਾਂ ਅਜੇ ਸ਼ਾਮਲ ਨਹੀਂ",
  "members.metrics.loading": "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ",
  "members.metrics.expiring": "30 ਦਿਨਾਂ ਵਿੱਚ ਮਿਆਦ ਖਤਮ",
  "members.metrics.expiringHint": "ਨਵਿਆਉਣ ਦੀਆਂ ਯਾਦ-ਦਹਾਨੀਆਂ ਇਨ੍ਹਾਂ ਮੈਂਬਰਾਂ ਨੂੰ ਜਾਂਦੀਆਂ ਹਨ",
  "members.metrics.officers": "ਅਧਿਕਾਰੀ",
  "members.metrics.officersHint": "ਵਲੰਟੀਅਰ, ਆਯੋਜਕ, ਖਜ਼ਾਨਚੀ ਅਤੇ ਲੀਡ",

  // Toolbar
  "members.search": "ਮੈਂਬਰ ਖੋਜੋ",
  "members.searchPlaceholder": "ਨਾਮ ਜਾਂ ਈਮੇਲ ਖੋਜੋ",
  "members.filterMembership": "ਮੈਂਬਰਸ਼ਿਪ ਅਨੁਸਾਰ ਫਿਲਟਰ ਕਰੋ",
  "members.filterRole": "ਭੂਮਿਕਾ ਅਨੁਸਾਰ ਫਿਲਟਰ ਕਰੋ",
  "members.allMemberships": "ਸਾਰੀਆਂ ਮੈਂਬਰਸ਼ਿਪਾਂ",
  "members.allRoles": "ਸਾਰੀਆਂ ਭੂਮਿਕਾਵਾਂ",
  "members.count.one": "{count} ਮੈਂਬਰ",
  "members.count.many": "{count} ਮੈਂਬਰ",

  // Directory
  "members.directory.kicker": "ਤੁਹਾਡੇ ਕਲੱਬ ਦਾ ਦਿਲ",
  "members.directory.title": "ਮੈਂਬਰ ਡਾਇਰੈਕਟਰੀ",
  "members.directory.noMatches": "ਕੋਈ ਮੇਲ ਨਹੀਂ",
  "members.directory.noMatchesBody": "ਕੋਈ ਹੋਰ ਖੋਜ ਜਾਂ ਫਿਲਟਰ ਅਜ਼ਮਾਓ।",
  "members.directory.empty": "ਅਜੇ ਕੋਈ ਮੈਂਬਰ ਨਹੀਂ",
  "members.directory.emptyBody": "ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਪਹਿਲਾ ਮੈਂਬਰ ਜੋੜੋ।",
  "members.col.dues": "ਮੈਂਬਰਸ਼ਿਪ ਫੀਸ",
  "members.membershipExpired": "ਮੈਂਬਰਸ਼ਿਪ ਦੀ ਮਿਆਦ ਖਤਮ",
  "members.notYetJoined": "ਅਜੇ ਸ਼ਾਮਲ ਨਹੀਂ",

  // Expiring card
  "members.expiring.kicker": "ਨਵਿਆਉਣ ਬਾਕੀ",
  "members.expiring.title": "30 ਦਿਨਾਂ ਵਿੱਚ ਮਿਆਦ ਖਤਮ ਹੋਣ ਵਾਲੀਆਂ",
  "members.expiring.none": "ਅਗਲੇ 30 ਦਿਨਾਂ ਵਿੱਚ ਕਿਸੇ ਮੈਂਬਰਸ਼ਿਪ ਦੀ ਮਿਆਦ ਖਤਮ ਨਹੀਂ ਹੁੰਦੀ।",
  "members.expiring.today": "ਅੱਜ ਮਿਆਦ ਖਤਮ",
  "members.expiring.daysLeft.one": "{count} ਦਿਨ ਬਾਕੀ",
  "members.expiring.daysLeft.many": "{count} ਦਿਨ ਬਾਕੀ",
  "members.expiring.recordDues": "ਫੀਸ ਦਰਜ ਕਰੋ",
  "members.previewNote": "ਫੀਸ ਅਧਿਕਾਰੀਆਂ ਵੱਲੋਂ ਕਲੱਬ ਦੀ ਤੈਅ ਸਾਲਾਨਾ ਰਕਮ ਅਨੁਸਾਰ ਦਰਜ ਕੀਤੀ ਜਾਂਦੀ ਹੈ। ਨਵਿਆਉਣ ਦੀਆਂ ਯਾਦ-ਦਹਾਨੀਆਂ ਐਪ ਵਿੱਚ ਨੋਟਿਸ ਅਤੇ ਸਿਮੂਲੇਟਿਡ ਆਊਟਬਾਕਸ ਕਤਾਰਾਂ ਬਣਾਉਂਦੀਆਂ ਹਨ; ਕੋਈ ਈਮੇਲ ਨਹੀਂ ਭੇਜੀ ਜਾਂਦੀ।",

  // Add member panel
  "members.add.title": "ਇੱਕ ਮੈਂਬਰ ਜੋੜੋ",
  "members.add.description": "ਬਿਨਾਂ ਲੌਗਇਨ ਜਾਂ ਭੁਗਤਾਨ ਦੇ ਕਲੱਬ ਰਿਕਾਰਡ ਬਣਾਉਂਦਾ ਹੈ। ਮੈਂਬਰਸ਼ਿਪ ਸਰਗਰਮ ਕਰਨ ਲਈ ਫੀਸ ਵੱਖਰੇ ਤੌਰ 'ਤੇ ਦਰਜ ਕਰੋ।",
  "members.add.fullName": "ਪੂਰਾ ਨਾਮ",
  "members.add.namePlaceholder": "Asha Demo",
  "members.add.emailPlaceholder": "asha@example.com",
  "members.add.submit": "ਡਾਇਰੈਕਟਰੀ ਵਿੱਚ ਜੋੜੋ",
  "members.add.nameError": "ਮੈਂਬਰ ਦਾ ਨਾਮ ਦਰਜ ਕਰੋ (2–120 ਅੱਖਰ)।",
  "members.add.emailError": "ਇੱਕ ਸਹੀ ਈਮੇਲ ਪਤਾ ਦਰਜ ਕਰੋ।",
  "members.add.duplicate": "ਇਸ ਈਮੇਲ ਵਾਲਾ ਮੈਂਬਰ ਪਹਿਲਾਂ ਹੀ ਮੌਜੂਦ ਹੈ।",
  "members.add.failed": "ਅਸੀਂ ਮੈਂਬਰ ਨਹੀਂ ਜੋੜ ਸਕੇ।",

  // Reminders panel
  "members.reminders.title": "ਨਵਿਆਉਣ ਦੀਆਂ ਯਾਦ-ਦਹਾਨੀਆਂ ਭੇਜੋ",
  "members.reminders.description": "ਮਿਆਦ ਦੇ ਅੰਦਰ ਮੈਂਬਰਸ਼ਿਪ ਖਤਮ ਹੋਣ ਵਾਲੇ ਹਰ ਮੈਂਬਰ ਲਈ ਇੱਕ ਐਪ ਸੂਚਨਾ ਅਤੇ ਇੱਕ ਸਿਮੂਲੇਟਿਡ ਆਊਟਬਾਕਸ ਕਤਾਰ। ਦੁਬਾਰਾ ਚਲਾਉਣ 'ਤੇ ਉਸੇ ਮਿਆਦ ਲਈ ਪਹਿਲਾਂ ਯਾਦ ਕਰਵਾਏ ਮੈਂਬਰ ਛੱਡ ਦਿੱਤੇ ਜਾਂਦੇ ਹਨ।",
  "members.reminders.window": "ਮਿਆਦ (ਦਿਨ)",
  "members.reminders.windowError": "1 ਤੋਂ 365 ਵਿਚਕਾਰ ਦਿਨਾਂ ਦਾ ਪੂਰਾ ਅੰਕ ਦਰਜ ਕਰੋ।",
  "members.reminders.result": "ਅਗਲੇ {days} ਦਿਨਾਂ ਲਈ ਯਾਦ-ਦਹਾਨੀਆਂ: {candidates} ਉਮੀਦਵਾਰ, {sent} ਭੇਜੀਆਂ, {skipped} ਪਹਿਲਾਂ ਯਾਦ ਕਰਵਾਏ। ਡਿਲੀਵਰੀ ਸਿਮੂਲੇਟਿਡ ਹੈ; ਕੋਈ ਈਮੇਲ ਸਿਸਟਮ ਤੋਂ ਬਾਹਰ ਨਹੀਂ ਜਾਂਦੀ।",
  "members.reminders.failed": "ਅਸੀਂ ਯਾਦ-ਦਹਾਨੀਆਂ ਨਹੀਂ ਭੇਜ ਸਕੇ।",

  // Detail page
  "members.detail.title": "ਮੈਂਬਰ",
  "members.detail.officerOnly.title": "ਸਿਰਫ਼ ਅਧਿਕਾਰੀਆਂ ਲਈ ਪੰਨਾ",
  "members.detail.officerOnly.body": "ਮੈਂਬਰ ਰਿਕਾਰਡ ਆਯੋਜਕਾਂ, ਖਜ਼ਾਨਚੀਆਂ ਅਤੇ ਐਡਮਿਨਾਂ ਨੂੰ ਦਿਖਦੇ ਹਨ।",
  "members.detail.notFound": "ਮੈਂਬਰ ਨਹੀਂ ਮਿਲਿਆ",
  "members.detail.notFoundTitle": "ਇਸ ਕਲੱਬ ਵਿੱਚ ਅਜਿਹਾ ਕੋਈ ਮੈਂਬਰ ਨਹੀਂ",
  "members.detail.notFoundBody": "ਲਿੰਕ ਪੁਰਾਣਾ ਹੋ ਸਕਦਾ ਹੈ, ਜਾਂ ਮੈਂਬਰ ਕਿਸੇ ਹੋਰ ਕਲੱਬ ਦਾ ਹੈ।",
  "members.detail.backToMembers": "ਮੈਂਬਰਾਂ 'ਤੇ ਵਾਪਸ",
  "members.detail.allMembers": "ਸਾਰੇ ਮੈਂਬਰ",
  "members.detail.profile.kicker": "ਮੈਂਬਰ ਰਿਕਾਰਡ",
  "members.detail.profile.title": "ਪ੍ਰੋਫਾਈਲ",
  "members.detail.expiresOn": "ਮਿਆਦ ਖਤਮ ਹੋਣ ਦੀ ਤਾਰੀਖ",
  "members.detail.dues": "ਫੀਸ",
  "members.detail.doorCode": "ਡੋਰ ਕੋਡ",
  "members.detail.accessKicker": "ਐਕਸੈਸ",
  "members.detail.accessTitle": "ਭੂਮਿਕਾ ਬਦਲਾਅ",
  "members.detail.accessBody": "ਸਿਰਫ਼ ਕਲੱਬ ਲੀਡ ਹੀ ਭੂਮਿਕਾਵਾਂ ਬਦਲ ਜਾਂ ਪਾਸਵਰਡ ਸੈੱਟ ਕਰ ਸਕਦਾ ਹੈ।",
  "members.detail.previewNote": "ਭੂਮਿਕਾ ਬਦਲਾਅ ਅਤੇ ਪਾਸਵਰਡ ਰੀਸੈੱਟ ਆਡਿਟ ਟ੍ਰੇਲ ਵਿੱਚ ਲਿਖੇ ਜਾਂਦੇ ਹਨ। ਫੀਸ ਉਹੀ ਹਵਾਲਾ ਸੁਰੱਖਿਅਤ ਢੰਗ ਨਾਲ ਦੁਹਰਾਉਂਦੀ ਹੈ ਅਤੇ ਕਦੇ ਦੋ ਵਾਰ ਕ੍ਰੈਡਿਟ ਨਹੀਂ ਹੁੰਦੀ।",

  // Dues history
  "members.history.kicker": "ਭੁਗਤਾਨ ਰਜਿਸਟਰ",
  "members.history.title": "ਫੀਸ ਇਤਿਹਾਸ",
  "members.history.empty": "ਅਜੇ ਕੋਈ ਫੀਸ ਦਰਜ ਨਹੀਂ",
  "members.history.emptyBody": "ਪਹਿਲਾ ਭੁਗਤਾਨ 365 ਦਿਨਾਂ ਲਈ ਮੈਂਬਰਸ਼ਿਪ ਸਰਗਰਮ ਕਰਦਾ ਹੈ।",
  "members.history.recorded": "ਦਰਜ ਕੀਤਾ",
  "members.history.expiry": "ਮਿਆਦ",
  "members.history.was": "ਪਹਿਲਾਂ {date} ਸੀ",
  "members.history.first": "ਪਹਿਲਾ ਭੁਗਤਾਨ",

  // Dues card
  "members.dues.title": "ਫੀਸ ਭੁਗਤਾਨ ਦਰਜ ਕਰੋ",
  "members.dues.description": "ਰਕਮ ਕਲੱਬ ਦੀ ਤੈਅ ਸਾਲਾਨਾ ਫੀਸ ਹੈ। ਪਹਿਲਾ ਭੁਗਤਾਨ 365 ਦਿਨਾਂ ਲਈ ਮੈਂਬਰਸ਼ਿਪ ਸਰਗਰਮ ਕਰਦਾ ਹੈ; ਨਵਿਆਉਣ ਅੱਜ ਜਾਂ ਮੌਜੂਦਾ ਮਿਆਦ, ਜੋ ਵੀ ਬਾਅਦ ਵਿੱਚ ਹੋਵੇ, ਉਸ ਵਿੱਚ 365 ਦਿਨ ਜੋੜਦਾ ਹੈ, ਇਸ ਲਈ ਜਲਦੀ ਭੁਗਤਾਨ ਕਰਨ ਨਾਲ ਕਦੇ ਦਿਨ ਨਹੀਂ ਘਟਦੇ।",
  "members.dues.reference": "ਭੁਗਤਾਨ ਹਵਾਲਾ",
  "members.dues.referencePlaceholder": "UPI / ਬੈਂਕ / ਨਕਦ ਰਸੀਦ ਹਵਾਲਾ",
  "members.dues.referenceError": "ਭੁਗਤਾਨ ਹਵਾਲਾ ਦਰਜ ਕਰੋ (ਘੱਟੋ-ਘੱਟ 3 ਅੱਖਰ)।",
  "members.dues.submit": "ਭੁਗਤਾਨ ਦਰਜ ਕਰੋ",
  "members.dues.replayHint": "ਉਹੀ ਹਵਾਲਾ ਦੁਬਾਰਾ ਦੇਣਾ ਸੁਰੱਖਿਅਤ ਹੈ: ਇਹ ਅਸਲ ਭੁਗਤਾਨ ਵਾਪਸ ਦਿੰਦਾ ਹੈ।",
  "members.dues.recorded": "ਫੀਸ ਦਰਜ ਹੋ ਗਈ। {name} ਦੀ ਮੈਂਬਰਸ਼ਿਪ ਹੁਣ {date} ਤੱਕ ਹੈ।",
  "members.dues.replayed": "ਹਵਾਲਾ \"{reference}\" {name} ਲਈ ਪਹਿਲਾਂ ਹੀ ਦਰਜ ਸੀ; ਕੁਝ ਵੀ ਦੁਬਾਰਾ ਕ੍ਰੈਡਿਟ ਨਹੀਂ ਹੋਇਆ। ਮੈਂਬਰਸ਼ਿਪ {date} ਤੱਕ ਹੈ।",

  // Role card
  "members.role.title": "ਭੂਮਿਕਾ",
  "members.role.description": "ਭੂਮਿਕਾ ਬਦਲਾਅ ਆਡਿਟ ਟ੍ਰੇਲ ਵਿੱਚ ਲਿਖੇ ਜਾਂਦੇ ਹਨ।",
  "members.role.self": "ਤੁਸੀਂ ਆਪਣੀ ਭੂਮਿਕਾ ਨਹੀਂ ਬਦਲ ਸਕਦੇ। ਕਿਸੇ ਹੋਰ ਐਡਮਿਨ ਨੂੰ ਕਹੋ।",
  "members.role.label": "ਕਲੱਬ ਭੂਮਿਕਾ",
  "members.role.submit": "ਭੂਮਿਕਾ ਬਦਲੋ",
  "members.role.pickDifferent": "ਪਹਿਲਾਂ ਕੋਈ ਵੱਖਰੀ ਭੂਮਿਕਾ ਚੁਣੋ।",
  "members.role.changed": "{name} ਹੁਣ {role} ਹੈ।",
  "members.role.ownRole": "ਤੁਸੀਂ ਆਪਣੀ ਭੂਮਿਕਾ ਨਹੀਂ ਬਦਲ ਸਕਦੇ।",
  "members.role.failed": "ਅਸੀਂ ਭੂਮਿਕਾ ਨਹੀਂ ਬਦਲ ਸਕੇ।",

  // Password card
  "members.password.title": "ਪਾਸਵਰਡ ਸੈੱਟ ਕਰੋ",
  "members.password.description": "ਇਸ ਮੈਂਬਰ ਨੂੰ ਲੌਗਇਨ ਦਿੰਦਾ ਹੈ, ਜਾਂ ਭੁੱਲਿਆ ਪਾਸਵਰਡ ਰੀਸੈੱਟ ਕਰਦਾ ਹੈ। ਇਹ ਆਡਿਟ ਹੁੰਦਾ ਹੈ।",
  "members.password.new": "ਨਵਾਂ ਪਾਸਵਰਡ",
  "members.password.confirm": "ਪਾਸਵਰਡ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ",
  "members.password.submit": "ਪਾਸਵਰਡ ਸੈੱਟ ਕਰੋ",
  "members.password.lengthError": "8 ਤੋਂ 200 ਅੱਖਰ ਵਰਤੋ।",
  "members.password.mismatch": "ਪਾਸਵਰਡ ਮੇਲ ਨਹੀਂ ਖਾਂਦੇ।",
  "members.password.done": "{name} ਲਈ ਪਾਸਵਰਡ ਸੈੱਟ ਹੋ ਗਿਆ। ਇਸ ਨੂੰ ਨਿੱਜੀ ਤੌਰ 'ਤੇ ਸਾਂਝਾ ਕਰੋ; ਉਹ ਸੈਟਿੰਗਾਂ ਤੋਂ ਇਸ ਨੂੰ ਬਦਲ ਸਕਦੇ ਹਨ।",
};

export default members;
