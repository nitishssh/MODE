import type en from "../en/announcements";

const announcements: Record<keyof typeof en, string> = {
  // Page
  "announcements.eyebrow.club": "ಕ್ಲಬ್",
  "announcements.eyebrow.section": "ಸೂಚನೆಗಳು",
  "announcements.title": "ಪ್ರಕಟಣೆಗಳು",
  "announcements.description": "ಕ್ಲಬ್ ಪ್ರಕಟಿಸಿದ ಎಲ್ಲದರ ದಿನಾಂಕವಾರು ಆರ್ಕೈವ್, ಹೊಸವು ಮೊದಲು.",
  "announcements.new": "ಹೊಸ ಪ್ರಕಟಣೆ",
  "announcements.loading": "ಸೂಚನಾ ಫಲಕ ತೆರೆಯಲಾಗುತ್ತಿದೆ…",
  "announcements.loadError": "ಸೂಚನಾ ಫಲಕ ಲೋಡ್ ಆಗಲಿಲ್ಲ",
  "announcements.previewNote": "ಪ್ರಕಟಣೆ ಪ್ರತಿ ಸಕ್ರಿಯ ಸದಸ್ಯರಿಗೆ ಒಂದು ಆ್ಯಪ್ ಅಧಿಸೂಚನೆ ಮತ್ತು ಒಂದು ಸಿಮ್ಯುಲೇಟೆಡ್ ಔಟ್‌ಬಾಕ್ಸ್ ಸಾಲನ್ನು ಸೃಷ್ಟಿಸುತ್ತದೆ. ಇಮೇಲ್ ಅಥವಾ WhatsApp ಕಳುಹಿಸುವುದಿಲ್ಲ.",

  // Publish result
  "announcements.result.published": "ಪ್ರಕಟಿಸಲಾಗಿದೆ",
  "announcements.result.alreadyPublished": "ಈಗಾಗಲೇ ಪ್ರಕಟಿಸಲಾಗಿದೆ",
  "announcements.result.reach.one": "“{title}” ಆ್ಯಪ್‌ನಲ್ಲಿ {count} ಸಕ್ರಿಯ ಸದಸ್ಯರನ್ನು ತಲುಪಿದೆ. ವಿತರಣೆ ಸಿಮ್ಯುಲೇಟೆಡ್: ಇಮೇಲ್ ಅಥವಾ WhatsApp ಕಳುಹಿಸುವುದಿಲ್ಲ.",
  "announcements.result.reach.many": "“{title}” ಆ್ಯಪ್‌ನಲ್ಲಿ {count} ಸಕ್ರಿಯ ಸದಸ್ಯರನ್ನು ತಲುಪಿದೆ. ವಿತರಣೆ ಸಿಮ್ಯುಲೇಟೆಡ್: ಇಮೇಲ್ ಅಥವಾ WhatsApp ಕಳುಹಿಸುವುದಿಲ್ಲ.",

  // Toolbar / archive
  "announcements.archive": "ಆರ್ಕೈವ್",
  "announcements.count.one": "{total} ರಲ್ಲಿ {visible} ಪ್ರಕಟಣೆ",
  "announcements.count.many": "{total} ರಲ್ಲಿ {visible} ಪ್ರಕಟಣೆಗಳು",
  "announcements.search": "ಪ್ರಕಟಣೆಗಳನ್ನು ಹುಡುಕಿ",
  "announcements.read": "ಓದಿ",
  "announcements.empty.noMatch": "ಹೊಂದುವ ಪ್ರಕಟಣೆಗಳಿಲ್ಲ",
  "announcements.empty.quiet": "ಸೂಚನಾ ಫಲಕ ಶಾಂತವಾಗಿದೆ",
  "announcements.empty.differentSearch": "ಬೇರೆ ಹುಡುಕಾಟ ಪ್ರಯತ್ನಿಸಿ.",
  "announcements.empty.publishFirst": "ಮೇಲಿನ ಬಟನ್‌ನಿಂದ ಮೊದಲ ಪ್ರಕಟಣೆ ಪ್ರಕಟಿಸಿ.",
  "announcements.empty.none": "ಕ್ಲಬ್ ಪ್ರಕಟಿಸಿದ ಸೂಚನೆಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.",

  // Publish panel
  "announcements.publish.title": "ಪ್ರಕಟಣೆ ಪ್ರಕಟಿಸಿ",
  "announcements.publish.description": "ಪ್ರಕಟಣೆ ತಕ್ಷಣ ಆಗುತ್ತದೆ ಮತ್ತು ಪ್ರತಿ ಸಕ್ರಿಯ ಸದಸ್ಯರಿಗೆ ಒಂದು ಅಧಿಸೂಚನೆ ಸೃಷ್ಟಿಸುತ್ತದೆ. ತಿದ್ದುಪಡಿಗಳಿಗೆ ಹೊಸ ಪ್ರಕಟಣೆ ಬೇಕು.",
  "announcements.publish.titleLabel": "ಶೀರ್ಷಿಕೆ",
  "announcements.publish.titlePlaceholder": "ಸದಸ್ಯರು ತಿಳಿಯಬೇಕಾದದ್ದು",
  "announcements.publish.message": "ಸಂದೇಶ",
  "announcements.publish.messagePlaceholder": "ಸರಳ ಪಠ್ಯ",
  "announcements.publish.counter": "{count} / 10,000 ಅಕ್ಷರಗಳು. ಪ್ರಕಟಿಸುವವರೆಗೆ ಕರಡುಗಳು ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಉಳಿಯುತ್ತವೆ.",
  "announcements.publish.titleError": "ಶೀರ್ಷಿಕೆ 3 ರಿಂದ 160 ಅಕ್ಷರಗಳಿರಬೇಕು.",
  "announcements.publish.bodyError": "ಸಂದೇಶ 1 ರಿಂದ 10,000 ಅಕ್ಷರಗಳಿರಬೇಕು.",
  "announcements.publish.confirm": "ಈಗಲೇ ಪ್ರಕಟಿಸುವುದೇ? ಇದು ಪ್ರತಿ ಸಕ್ರಿಯ ಸದಸ್ಯರಿಗೆ ಆ್ಯಪ್ ಸೂಚನೆ ಕಳುಹಿಸುತ್ತದೆ ಮತ್ತು ನಂತರ ಸಂಪಾದಿಸಲಾಗದು.",
  "announcements.publish.freshDraft": "ಹೊಸ ಕರಡು ಪ್ರಾರಂಭಿಸಿ",
  "announcements.publish.submit": "ಸಕ್ರಿಯ ಸದಸ್ಯರಿಗೆ ಪ್ರಕಟಿಸಿ",
  "announcements.publish.publishing": "ಪ್ರಕಟಿಸಲಾಗುತ್ತಿದೆ…",
  "announcements.publish.discard": "ಕರಡು ತ್ಯಜಿಸಿ",

  // Detail page
  "announcements.detail.title": "ಪ್ರಕಟಣೆ",
  "announcements.detail.publishedAt": "{when} ಪ್ರಕಟಿಸಲಾಗಿದೆ",
  "announcements.detail.all": "ಎಲ್ಲಾ ಪ್ರಕಟಣೆಗಳು",
  "announcements.detail.loading": "ಸೂಚನೆ ತೆರೆಯಲಾಗುತ್ತಿದೆ…",
  "announcements.detail.unavailable": "ಪ್ರಕಟಣೆ ಲಭ್ಯವಿಲ್ಲ",
  "announcements.detail.notFound": "ಈ ಪ್ರಕಟಣೆ ಸಿಗಲಿಲ್ಲ.",

  // Outbox
  "announcements.outbox.kicker": "ಸಿಮ್ಯುಲೇಟೆಡ್ ವಿತರಣೆ",
  "announcements.outbox.title": "ಔಟ್‌ಬಾಕ್ಸ್",
  "announcements.outbox.reload": "ಮತ್ತೆ ಲೋಡ್ ಮಾಡಿ",
  "announcements.outbox.footnote": "ಪ್ರಕಟಣೆಯ ಸಮಯದಲ್ಲಿ ಪ್ರತಿ ಸಕ್ರಿಯ ಸದಸ್ಯರಿಗೆ ಒಂದು ಸಂಗ್ರಹಿತ ಸಾಲು. ಸಾಲು ಏನು ದಾಖಲಾಯಿತು ಎಂಬುದನ್ನು ಸಾಬೀತುಪಡಿಸುತ್ತದೆ, ಇಮೇಲ್ ಅಥವಾ ಸಂದೇಶ ತಲುಪಿತು ಎಂದಲ್ಲ: ಹೊರಗೆ ಏನೂ ಕಳುಹಿಸುವುದಿಲ್ಲ.",
  "announcements.outbox.load": "ಸ್ವೀಕರಿಸುವವರನ್ನು ಲೋಡ್ ಮಾಡಿ",
  "announcements.outbox.loadError": "ಔಟ್‌ಬಾಕ್ಸ್ ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.",
  "announcements.outbox.recipient": "ಸ್ವೀಕರಿಸುವವರು",
  "announcements.outbox.subject": "ವಿಷಯ",
  "announcements.outbox.recorded": "ದಾಖಲಾಗಿದೆ",
  "announcements.outbox.empty": "ಸ್ವೀಕರಿಸುವವರು ದಾಖಲಾಗಿಲ್ಲ",
  "announcements.outbox.emptyBody": "ಇದನ್ನು ಪ್ರಕಟಿಸಿದಾಗ ಯಾವ ಸದಸ್ಯರಿಗೂ ಸಕ್ರಿಯ ಸದಸ್ಯತ್ವ ಇರಲಿಲ್ಲ.",
};

export default announcements;
