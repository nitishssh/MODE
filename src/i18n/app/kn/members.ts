import type en from "../en/members";

const members: Record<keyof typeof en, string> = {
  // Page
  "members.eyebrow.club": "ಕ್ಲಬ್",
  "members.eyebrow.section": "ಸದಸ್ಯರು",
  "members.title": "ಸದಸ್ಯರು",
  "members.description": "ಕ್ಲಬ್‌ನಲ್ಲಿರುವ ಎಲ್ಲರೂ, ಅವರ ಪಾತ್ರ ಮತ್ತು ಅವರ ಸದಸ್ಯತ್ವ ಸ್ಥಿತಿ.",
  "members.officerOnly.title": "ಅಧಿಕಾರಿಗಳಿಗೆ ಮಾತ್ರ ಡೈರೆಕ್ಟರಿ",
  "members.officerOnly.body": "ಇಮೇಲ್ ಮತ್ತು ಶುಲ್ಕಗಳೊಂದಿಗಿನ ಸದಸ್ಯರ ಡೈರೆಕ್ಟರಿ ಸಂಘಟಕರು, ಖಜಾಂಚಿಗಳು ಮತ್ತು ಅಡ್ಮಿನ್‌ಗಳಿಗೆ ಕಾಣುತ್ತದೆ. ನಿಮ್ಮ ಸ್ವಂತ ಪಾಸ್ “ನನ್ನ ಪಾಸ್” ಅಡಿಯಲ್ಲಿದೆ.",
  "members.runReminders": "ನೆನಪೋಲೆಗಳನ್ನು ಕಳುಹಿಸಿ",
  "members.addMember": "ಸದಸ್ಯರನ್ನು ಸೇರಿಸಿ",
  "members.loadError": "ಡೈರೆಕ್ಟರಿ ಲೋಡ್ ಆಗಲಿಲ್ಲ",
  "members.added": "{name} ಅವರನ್ನು ಕ್ಲಬ್‌ಗೆ ಸೇರಿಸಲಾಗಿದೆ.",

  // Metrics
  "members.metrics.label": "ಸದಸ್ಯತ್ವ ಅಂಕಿಅಂಶಗಳು",
  "members.metrics.total": "ಒಟ್ಟು ಸದಸ್ಯರು",
  "members.metrics.totalHint": "ಕ್ಲಬ್ ರಿಜಿಸ್ಟರ್‌ನಲ್ಲಿರುವ ಎಲ್ಲರೂ",
  "members.metrics.active": "ಸಕ್ರಿಯ ಸದಸ್ಯತ್ವ",
  "members.metrics.activeHint": "{count} ಅವಧಿ ಮುಗಿದವರು ಅಥವಾ ಇನ್ನೂ ಸೇರದವರು",
  "members.metrics.loading": "ಲೋಡ್ ಆಗುತ್ತಿದೆ",
  "members.metrics.expiring": "30 ದಿನಗಳಲ್ಲಿ ಮುಕ್ತಾಯ",
  "members.metrics.expiringHint": "ನವೀಕರಣ ನೆನಪೋಲೆಗಳು ಈ ಸದಸ್ಯರಿಗೆ ಹೋಗುತ್ತವೆ",
  "members.metrics.officers": "ಅಧಿಕಾರಿಗಳು",
  "members.metrics.officersHint": "ಸ್ವಯಂಸೇವಕರು, ಸಂಘಟಕರು, ಖಜಾಂಚಿಗಳು ಮತ್ತು ಮುಖ್ಯಸ್ಥರು",

  // Toolbar
  "members.search": "ಸದಸ್ಯರನ್ನು ಹುಡುಕಿ",
  "members.searchPlaceholder": "ಹೆಸರು ಅಥವಾ ಇಮೇಲ್ ಹುಡುಕಿ",
  "members.filterMembership": "ಸದಸ್ಯತ್ವದ ಪ್ರಕಾರ ಫಿಲ್ಟರ್ ಮಾಡಿ",
  "members.filterRole": "ಪಾತ್ರದ ಪ್ರಕಾರ ಫಿಲ್ಟರ್ ಮಾಡಿ",
  "members.allMemberships": "ಎಲ್ಲಾ ಸದಸ್ಯತ್ವಗಳು",
  "members.allRoles": "ಎಲ್ಲಾ ಪಾತ್ರಗಳು",
  "members.count.one": "{count} ಸದಸ್ಯ",
  "members.count.many": "{count} ಸದಸ್ಯರು",

  // Directory
  "members.directory.kicker": "ನಿಮ್ಮ ಕ್ಲಬ್‌ನ ಹೃದಯ",
  "members.directory.title": "ಸದಸ್ಯರ ಡೈರೆಕ್ಟರಿ",
  "members.directory.noMatches": "ಹೊಂದಿಕೆಗಳಿಲ್ಲ",
  "members.directory.noMatchesBody": "ಬೇರೆ ಹುಡುಕಾಟ ಅಥವಾ ಫಿಲ್ಟರ್ ಪ್ರಯತ್ನಿಸಿ.",
  "members.directory.empty": "ಇನ್ನೂ ಸದಸ್ಯರಿಲ್ಲ",
  "members.directory.emptyBody": "ಪ್ರಾರಂಭಿಸಲು ಮೊದಲ ಸದಸ್ಯರನ್ನು ಸೇರಿಸಿ.",
  "members.col.dues": "ಸದಸ್ಯತ್ವ ಶುಲ್ಕ",
  "members.membershipExpired": "ಸದಸ್ಯತ್ವದ ಅವಧಿ ಮುಗಿದಿದೆ",
  "members.notYetJoined": "ಇನ್ನೂ ಸೇರಿಲ್ಲ",

  // Expiring card
  "members.expiring.kicker": "ನವೀಕರಣಗಳು ಬಾಕಿ",
  "members.expiring.title": "30 ದಿನಗಳೊಳಗೆ ಮುಕ್ತಾಯ",
  "members.expiring.none": "ಮುಂದಿನ 30 ದಿನಗಳಲ್ಲಿ ಯಾವ ಸದಸ್ಯತ್ವವೂ ಮುಗಿಯುವುದಿಲ್ಲ.",
  "members.expiring.today": "ಇಂದು ಮುಕ್ತಾಯ",
  "members.expiring.daysLeft.one": "{count} ದಿನ ಬಾಕಿ",
  "members.expiring.daysLeft.many": "{count} ದಿನಗಳು ಬಾಕಿ",
  "members.expiring.recordDues": "ಶುಲ್ಕ ದಾಖಲಿಸಿ",
  "members.previewNote": "ಶುಲ್ಕವನ್ನು ಅಧಿಕಾರಿಗಳು ಕ್ಲಬ್‌ನ ನಿಗದಿತ ವಾರ್ಷಿಕ ಮೊತ್ತಕ್ಕೆ ಅನುಗುಣವಾಗಿ ದಾಖಲಿಸುತ್ತಾರೆ. ನವೀಕರಣ ನೆನಪೋಲೆಗಳು ಆ್ಯಪ್ ಸೂಚನೆಗಳು ಮತ್ತು ಸಿಮ್ಯುಲೇಟೆಡ್ ಔಟ್‌ಬಾಕ್ಸ್ ಸಾಲುಗಳನ್ನು ಸೃಷ್ಟಿಸುತ್ತವೆ; ಇಮೇಲ್ ಕಳುಹಿಸುವುದಿಲ್ಲ.",

  // Add member panel
  "members.add.title": "ಸದಸ್ಯರನ್ನು ಸೇರಿಸಿ",
  "members.add.description": "ಲಾಗಿನ್ ಅಥವಾ ಪಾವತಿ ಇಲ್ಲದೆ ಕ್ಲಬ್ ದಾಖಲೆ ರಚಿಸುತ್ತದೆ. ಸದಸ್ಯತ್ವ ಸಕ್ರಿಯಗೊಳಿಸಲು ಶುಲ್ಕವನ್ನು ಪ್ರತ್ಯೇಕವಾಗಿ ದಾಖಲಿಸಿ.",
  "members.add.fullName": "ಪೂರ್ಣ ಹೆಸರು",
  "members.add.namePlaceholder": "ಆಶಾ ಡೆಮೊ",
  "members.add.emailPlaceholder": "asha@example.com",
  "members.add.submit": "ಡೈರೆಕ್ಟರಿಗೆ ಸೇರಿಸಿ",
  "members.add.nameError": "ಸದಸ್ಯರ ಹೆಸರು ನಮೂದಿಸಿ (2–120 ಅಕ್ಷರಗಳು).",
  "members.add.emailError": "ಮಾನ್ಯ ಇಮೇಲ್ ವಿಳಾಸ ನಮೂದಿಸಿ.",
  "members.add.duplicate": "ಈ ಇಮೇಲ್‌ನೊಂದಿಗೆ ಸದಸ್ಯರು ಈಗಾಗಲೇ ಇದ್ದಾರೆ.",
  "members.add.failed": "ಸದಸ್ಯರನ್ನು ಸೇರಿಸಲಾಗಲಿಲ್ಲ.",

  // Reminders panel
  "members.reminders.title": "ನವೀಕರಣ ನೆನಪೋಲೆಗಳನ್ನು ಕಳುಹಿಸಿ",
  "members.reminders.description": "ಈ ಅವಧಿಯೊಳಗೆ ಸದಸ್ಯತ್ವ ಮುಗಿಯುವ ಪ್ರತಿ ಸದಸ್ಯರಿಗೆ ಒಂದು ಆ್ಯಪ್ ಅಧಿಸೂಚನೆ ಮತ್ತು ಒಂದು ಸಿಮ್ಯುಲೇಟೆಡ್ ಔಟ್‌ಬಾಕ್ಸ್ ಸಾಲು. ಮತ್ತೆ ರನ್ ಮಾಡಿದರೆ ಅದೇ ಮುಕ್ತಾಯಕ್ಕೆ ಈಗಾಗಲೇ ನೆನಪಿಸಿದ ಸದಸ್ಯರನ್ನು ಬಿಡಲಾಗುತ್ತದೆ.",
  "members.reminders.window": "ಅವಧಿ (ದಿನಗಳು)",
  "members.reminders.windowError": "1 ರಿಂದ 365 ರ ನಡುವೆ ಪೂರ್ಣ ಸಂಖ್ಯೆಯ ದಿನಗಳನ್ನು ನಮೂದಿಸಿ.",
  "members.reminders.result": "ಮುಂದಿನ {days} ದಿನಗಳಿಗೆ ನೆನಪೋಲೆಗಳು ರನ್ ಆದವು: {candidates} ಅಭ್ಯರ್ಥಿಗಳು, {sent} ಕಳುಹಿಸಲಾಗಿದೆ, {skipped} ಈಗಾಗಲೇ ನೆನಪಿಸಲಾಗಿದೆ. ವಿತರಣೆ ಸಿಮ್ಯುಲೇಟೆಡ್; ಸಿಸ್ಟಮ್‌ನಿಂದ ಇಮೇಲ್ ಹೊರಹೋಗುವುದಿಲ್ಲ.",
  "members.reminders.failed": "ನೆನಪೋಲೆಗಳನ್ನು ಕಳುಹಿಸಲಾಗಲಿಲ್ಲ.",

  // Detail page
  "members.detail.title": "ಸದಸ್ಯ",
  "members.detail.officerOnly.title": "ಅಧಿಕಾರಿಗಳಿಗೆ ಮಾತ್ರ ಪುಟ",
  "members.detail.officerOnly.body": "ಸದಸ್ಯರ ದಾಖಲೆಗಳು ಸಂಘಟಕರು, ಖಜಾಂಚಿಗಳು ಮತ್ತು ಅಡ್ಮಿನ್‌ಗಳಿಗೆ ಕಾಣುತ್ತವೆ.",
  "members.detail.notFound": "ಸದಸ್ಯರು ಸಿಗಲಿಲ್ಲ",
  "members.detail.notFoundTitle": "ಈ ಕ್ಲಬ್‌ನಲ್ಲಿ ಅಂತಹ ಸದಸ್ಯರಿಲ್ಲ",
  "members.detail.notFoundBody": "ಲಿಂಕ್ ಹಳೆಯದಾಗಿರಬಹುದು, ಅಥವಾ ಸದಸ್ಯರು ಬೇರೆ ಕ್ಲಬ್‌ಗೆ ಸೇರಿರಬಹುದು.",
  "members.detail.backToMembers": "ಸದಸ್ಯರಿಗೆ ಹಿಂತಿರುಗಿ",
  "members.detail.allMembers": "ಎಲ್ಲಾ ಸದಸ್ಯರು",
  "members.detail.profile.kicker": "ಸದಸ್ಯ ದಾಖಲೆ",
  "members.detail.profile.title": "ಪ್ರೊಫೈಲ್",
  "members.detail.expiresOn": "ಮುಕ್ತಾಯ ದಿನಾಂಕ",
  "members.detail.dues": "ಶುಲ್ಕ",
  "members.detail.doorCode": "ಡೋರ್ ಕೋಡ್",
  "members.detail.accessKicker": "ಪ್ರವೇಶ",
  "members.detail.accessTitle": "ಪಾತ್ರ ಬದಲಾವಣೆಗಳು",
  "members.detail.accessBody": "ಕ್ಲಬ್ ಮುಖ್ಯಸ್ಥರು ಮಾತ್ರ ಪಾತ್ರ ಬದಲಿಸಬಹುದು ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ನಿಗದಿಪಡಿಸಬಹುದು.",
  "members.detail.previewNote": "ಪಾತ್ರ ಬದಲಾವಣೆಗಳು ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ರೀಸೆಟ್‌ಗಳು ಆಡಿಟ್ ಟ್ರೇಲ್‌ನಲ್ಲಿ ದಾಖಲಾಗುತ್ತವೆ. ಅದೇ ರೆಫರೆನ್ಸ್‌ನೊಂದಿಗೆ ಶುಲ್ಕ ಮತ್ತೆ ದಾಖಲಿಸಿದರೆ ಸುರಕ್ಷಿತವಾಗಿ ಅದೇ ಪಾವತಿ ಮರಳುತ್ತದೆ; ಎರಡು ಬಾರಿ ಜಮೆ ಆಗುವುದಿಲ್ಲ.",

  // Dues history
  "members.history.kicker": "ಪಾವತಿ ರಿಜಿಸ್ಟರ್",
  "members.history.title": "ಶುಲ್ಕ ಇತಿಹಾಸ",
  "members.history.empty": "ಇನ್ನೂ ಶುಲ್ಕ ದಾಖಲಾಗಿಲ್ಲ",
  "members.history.emptyBody": "ಮೊದಲ ಪಾವತಿ ಸದಸ್ಯತ್ವವನ್ನು 365 ದಿನಗಳಿಗೆ ಸಕ್ರಿಯಗೊಳಿಸುತ್ತದೆ.",
  "members.history.recorded": "ದಾಖಲಾಗಿದೆ",
  "members.history.expiry": "ಮುಕ್ತಾಯ",
  "members.history.was": "ಮೊದಲು {date}",
  "members.history.first": "ಮೊದಲ ಪಾವತಿ",

  // Dues card
  "members.dues.title": "ಶುಲ್ಕ ಪಾವತಿ ದಾಖಲಿಸಿ",
  "members.dues.description": "ಮೊತ್ತವು ಕ್ಲಬ್‌ನ ನಿಗದಿತ ವಾರ್ಷಿಕ ಶುಲ್ಕ. ಮೊದಲ ಪಾವತಿ ಸದಸ್ಯತ್ವವನ್ನು 365 ದಿನಗಳಿಗೆ ಸಕ್ರಿಯಗೊಳಿಸುತ್ತದೆ; ನವೀಕರಣವು ಇಂದು ಅಥವಾ ಪ್ರಸ್ತುತ ಮುಕ್ತಾಯದಲ್ಲಿ ಯಾವುದು ನಂತರವೋ ಅದಕ್ಕೆ 365 ದಿನ ಸೇರಿಸುತ್ತದೆ, ಹಾಗಾಗಿ ಮುಂಚಿತವಾಗಿ ಪಾವತಿಸಿದರೆ ದಿನಗಳು ಕಳೆದುಹೋಗುವುದಿಲ್ಲ.",
  "members.dues.reference": "ಪಾವತಿ ರೆಫರೆನ್ಸ್",
  "members.dues.referencePlaceholder": "UPI / ಬ್ಯಾಂಕ್ / ನಗದು ರಸೀದಿ ರೆಫರೆನ್ಸ್",
  "members.dues.referenceError": "ಪಾವತಿ ರೆಫರೆನ್ಸ್ ನಮೂದಿಸಿ (ಕನಿಷ್ಠ 3 ಅಕ್ಷರಗಳು).",
  "members.dues.submit": "ಪಾವತಿ ದಾಖಲಿಸಿ",
  "members.dues.replayHint": "ಅದೇ ರೆಫರೆನ್ಸ್ ಮತ್ತೆ ದಾಖಲಿಸುವುದು ಸುರಕ್ಷಿತ: ಅದು ಮೂಲ ಪಾವತಿಯನ್ನು ಹಿಂತಿರುಗಿಸುತ್ತದೆ.",
  "members.dues.recorded": "ಶುಲ್ಕ ದಾಖಲಾಗಿದೆ. {name} ಅವರ ಸದಸ್ಯತ್ವ ಈಗ {date} ವರೆಗೆ ಇದೆ.",
  "members.dues.replayed": "ರೆಫರೆನ್ಸ್ \"{reference}\" ಈಗಾಗಲೇ {name} ಅವರಿಗೆ ದಾಖಲಾಗಿದೆ; ಮತ್ತೆ ಏನೂ ಜಮೆ ಆಗಿಲ್ಲ. ಸದಸ್ಯತ್ವ {date} ವರೆಗೆ ಇದೆ.",

  // Role card
  "members.role.title": "ಪಾತ್ರ",
  "members.role.description": "ಪಾತ್ರ ಬದಲಾವಣೆಗಳು ಆಡಿಟ್ ಟ್ರೇಲ್‌ನಲ್ಲಿ ದಾಖಲಾಗುತ್ತವೆ.",
  "members.role.self": "ನಿಮ್ಮ ಸ್ವಂತ ಪಾತ್ರವನ್ನು ನೀವು ಬದಲಿಸಲಾಗದು. ಬೇರೆ ಅಡ್ಮಿನ್ ಅನ್ನು ಕೇಳಿ.",
  "members.role.label": "ಕ್ಲಬ್ ಪಾತ್ರ",
  "members.role.submit": "ಪಾತ್ರ ಬದಲಿಸಿ",
  "members.role.pickDifferent": "ಮೊದಲು ಬೇರೆ ಪಾತ್ರ ಆಯ್ಕೆಮಾಡಿ.",
  "members.role.changed": "{name} ಈಗ {role}.",
  "members.role.ownRole": "ನಿಮ್ಮ ಸ್ವಂತ ಪಾತ್ರವನ್ನು ನೀವು ಬದಲಿಸಲಾಗದು.",
  "members.role.failed": "ಪಾತ್ರ ಬದಲಿಸಲಾಗಲಿಲ್ಲ.",

  // Password card
  "members.password.title": "ಪಾಸ್‌ವರ್ಡ್ ನಿಗದಿಪಡಿಸಿ",
  "members.password.description": "ಈ ಸದಸ್ಯರಿಗೆ ಲಾಗಿನ್ ನೀಡುತ್ತದೆ, ಅಥವಾ ಮರೆತ ಪಾಸ್‌ವರ್ಡ್ ರೀಸೆಟ್ ಮಾಡುತ್ತದೆ. ಇದು ಆಡಿಟ್ ಆಗುತ್ತದೆ.",
  "members.password.new": "ಹೊಸ ಪಾಸ್‌ವರ್ಡ್",
  "members.password.confirm": "ಪಾಸ್‌ವರ್ಡ್ ದೃಢೀಕರಿಸಿ",
  "members.password.submit": "ಪಾಸ್‌ವರ್ಡ್ ನಿಗದಿಪಡಿಸಿ",
  "members.password.lengthError": "8 ರಿಂದ 200 ಅಕ್ಷರಗಳನ್ನು ಬಳಸಿ.",
  "members.password.mismatch": "ಪಾಸ್‌ವರ್ಡ್‌ಗಳು ಹೊಂದಿಕೆಯಾಗುತ್ತಿಲ್ಲ.",
  "members.password.done": "{name} ಅವರಿಗೆ ಪಾಸ್‌ವರ್ಡ್ ನಿಗದಿಯಾಗಿದೆ. ಅದನ್ನು ಖಾಸಗಿಯಾಗಿ ಹಂಚಿಕೊಳ್ಳಿ; ಅವರು ಸೆಟ್ಟಿಂಗ್‌ಗಳಿಂದ ಬದಲಿಸಬಹುದು.",
};

export default members;
