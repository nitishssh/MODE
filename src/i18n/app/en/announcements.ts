/** Announcements archive, publish panel and single-notice strings for the /app workspace. */
const announcements = {
  // Page
  "announcements.eyebrow.club": "CLUB",
  "announcements.eyebrow.section": "NOTICES",
  "announcements.title": "Announcements",
  "announcements.description": "Dated archive of everything the club has published, newest first.",
  "announcements.new": "New announcement",
  "announcements.loading": "Opening the noticeboard…",
  "announcements.loadError": "The noticeboard could not load",
  "announcements.previewNote": "Publication creates one in-app notification and one simulated outbox row per active member. No email or WhatsApp is sent.",

  // Publish result
  "announcements.result.published": "Published",
  "announcements.result.alreadyPublished": "Already published",
  "announcements.result.reach.one": "“{title}” reached {count} active member in-app. Delivery is simulated: no email or WhatsApp is sent.",
  "announcements.result.reach.many": "“{title}” reached {count} active members in-app. Delivery is simulated: no email or WhatsApp is sent.",

  // Toolbar / archive
  "announcements.archive": "ARCHIVE",
  "announcements.count.one": "{visible} of {total} announcement",
  "announcements.count.many": "{visible} of {total} announcements",
  "announcements.search": "Search announcements",
  "announcements.read": "Read",
  "announcements.empty.noMatch": "No matching announcements",
  "announcements.empty.quiet": "The noticeboard is quiet",
  "announcements.empty.differentSearch": "Try a different search.",
  "announcements.empty.publishFirst": "Publish the first announcement with the button above.",
  "announcements.empty.none": "Published notices from the club appear here.",

  // Publish panel
  "announcements.publish.title": "Publish an announcement",
  "announcements.publish.description": "Publishing is immediate and creates one notification per active member. Corrections need a new announcement.",
  "announcements.publish.titleLabel": "Title",
  "announcements.publish.titlePlaceholder": "What members need to know",
  "announcements.publish.message": "Message",
  "announcements.publish.messagePlaceholder": "Plain text",
  "announcements.publish.counter": "{count} / 10,000 characters. Drafts are kept in this browser until published.",
  "announcements.publish.titleError": "Title must be 3 to 160 characters.",
  "announcements.publish.bodyError": "Body must be 1 to 10,000 characters.",
  "announcements.publish.confirm": "Publish now? This sends an in-app notice to every active member and cannot be edited afterwards.",
  "announcements.publish.freshDraft": "Start a fresh draft",
  "announcements.publish.submit": "Publish to active members",
  "announcements.publish.publishing": "Publishing…",
  "announcements.publish.discard": "Discard draft",

  // Detail page
  "announcements.detail.title": "Announcement",
  "announcements.detail.publishedAt": "Published {when}",
  "announcements.detail.all": "All announcements",
  "announcements.detail.loading": "Opening the notice…",
  "announcements.detail.unavailable": "Announcement unavailable",
  "announcements.detail.notFound": "This announcement could not be found.",

  // Outbox
  "announcements.outbox.kicker": "SIMULATED DELIVERY",
  "announcements.outbox.title": "Outbox",
  "announcements.outbox.reload": "Reload",
  "announcements.outbox.footnote": "One stored row per active member at publication time. A row proves what was recorded, not that any email or message was delivered: nothing is sent externally.",
  "announcements.outbox.load": "Load recipients",
  "announcements.outbox.loadError": "Could not load the outbox.",
  "announcements.outbox.recipient": "Recipient",
  "announcements.outbox.subject": "Subject",
  "announcements.outbox.recorded": "Recorded",
  "announcements.outbox.empty": "No recipients recorded",
  "announcements.outbox.emptyBody": "No member had an active membership when this was published.",
} as const;

export default announcements;
