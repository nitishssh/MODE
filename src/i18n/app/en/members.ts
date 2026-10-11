/** Members directory and member detail strings for the /app workspace. */
const members = {
  // Page
  "members.eyebrow.club": "CLUB",
  "members.eyebrow.section": "MEMBERS",
  "members.title": "Members",
  "members.description": "Everyone in the club, their role, and where their membership stands.",
  "members.officerOnly.title": "Officer-only directory",
  "members.officerOnly.body": "The member directory, with emails and dues, is visible to organizers, treasurers and admins. Your own pass is under My pass.",
  "members.runReminders": "Run reminders",
  "members.addMember": "Add member",
  "members.loadError": "The directory could not load",
  "members.added": "{name} was added to the club.",

  // Metrics
  "members.metrics.label": "Membership figures",
  "members.metrics.total": "Total members",
  "members.metrics.totalHint": "Everyone on the club register",
  "members.metrics.active": "Active membership",
  "members.metrics.activeHint": "{count} expired or not yet joined",
  "members.metrics.loading": "Loading",
  "members.metrics.expiring": "Expiring in 30 days",
  "members.metrics.expiringHint": "Renewal reminders go to these members",
  "members.metrics.officers": "Officers",
  "members.metrics.officersHint": "Volunteers, organizers, treasurers and leads",

  // Toolbar
  "members.search": "Search members",
  "members.searchPlaceholder": "Search name or email",
  "members.filterMembership": "Filter by membership",
  "members.filterRole": "Filter by role",
  "members.allMemberships": "All memberships",
  "members.allRoles": "All roles",
  "members.count.one": "{count} member",
  "members.count.many": "{count} members",

  // Directory
  "members.directory.kicker": "THE HEART OF YOUR CLUB",
  "members.directory.title": "Member directory",
  "members.directory.noMatches": "No matches",
  "members.directory.noMatchesBody": "Try a different search or filter.",
  "members.directory.empty": "No members yet",
  "members.directory.emptyBody": "Add the first member to get started.",
  "members.col.dues": "Membership dues",
  "members.membershipExpired": "Membership expired",
  "members.notYetJoined": "Not yet joined",

  // Expiring card
  "members.expiring.kicker": "RENEWALS DUE",
  "members.expiring.title": "Expiring within 30 days",
  "members.expiring.none": "No memberships expire in the next 30 days.",
  "members.expiring.today": "Expires today",
  "members.expiring.daysLeft.one": "{count} day left",
  "members.expiring.daysLeft.many": "{count} days left",
  "members.expiring.recordDues": "Record dues",
  "members.previewNote": "Dues are recorded by officers against the club's fixed annual amount. Renewal reminders create in-app notices and simulated outbox rows; no email is sent.",

  // Add member panel
  "members.add.title": "Add a member",
  "members.add.description": "Creates a club record without a login or payment. Record dues separately to activate membership.",
  "members.add.fullName": "Full name",
  "members.add.namePlaceholder": "Asha Demo",
  "members.add.emailPlaceholder": "asha@example.com",
  "members.add.submit": "Add to directory",
  "members.add.nameError": "Enter the member's name (2–120 characters).",
  "members.add.emailError": "Enter a valid email address.",
  "members.add.duplicate": "A member with this email already exists.",
  "members.add.failed": "We could not add the member.",

  // Reminders panel
  "members.reminders.title": "Run renewal reminders",
  "members.reminders.description": "One in-app notification and one simulated outbox row per member whose membership expires within the window. Repeat runs skip members already reminded for the same expiry.",
  "members.reminders.window": "Window (days)",
  "members.reminders.windowError": "Enter a whole number of days between 1 and 365.",
  "members.reminders.result": "Reminders run for the next {days} days: {candidates} candidates, {sent} sent, {skipped} already reminded. Delivery is simulated; no email leaves the system.",
  "members.reminders.failed": "We could not run reminders.",

  // Detail page
  "members.detail.title": "Member",
  "members.detail.officerOnly.title": "Officer-only page",
  "members.detail.officerOnly.body": "Member records are visible to organizers, treasurers and admins.",
  "members.detail.notFound": "Member not found",
  "members.detail.notFoundTitle": "No such member in this club",
  "members.detail.notFoundBody": "The link may be stale, or the member belongs to another club.",
  "members.detail.backToMembers": "Back to members",
  "members.detail.allMembers": "All members",
  "members.detail.profile.kicker": "MEMBER RECORD",
  "members.detail.profile.title": "Profile",
  "members.detail.expiresOn": "Expires on",
  "members.detail.dues": "Dues",
  "members.detail.doorCode": "Door code",
  "members.detail.accessKicker": "ACCESS",
  "members.detail.accessTitle": "Role changes",
  "members.detail.accessBody": "Only the club lead can change roles or set passwords.",
  "members.detail.previewNote": "Role changes and password resets are written to the audit trail. Dues replay the same reference safely and never credit twice.",

  // Dues history
  "members.history.kicker": "PAYMENT REGISTER",
  "members.history.title": "Dues history",
  "members.history.empty": "No dues recorded yet",
  "members.history.emptyBody": "A first payment activates membership for 365 days.",
  "members.history.recorded": "Recorded",
  "members.history.expiry": "Expiry",
  "members.history.was": "was {date}",
  "members.history.first": "First payment",

  // Dues card
  "members.dues.title": "Record dues payment",
  "members.dues.description": "The amount is the club's fixed annual dues. A first payment activates membership for 365 days; a renewal adds 365 days to the later of today and the current expiry, so paying early never loses days.",
  "members.dues.reference": "Payment reference",
  "members.dues.referencePlaceholder": "UPI / bank / cash receipt reference",
  "members.dues.referenceError": "Enter the payment reference (at least 3 characters).",
  "members.dues.submit": "Record payment",
  "members.dues.replayHint": "Replaying the same reference is safe: it returns the original payment.",
  "members.dues.recorded": "Dues recorded. {name}'s membership now runs through {date}.",
  "members.dues.replayed": "Reference \"{reference}\" was already recorded for {name}; nothing was credited again. Membership runs through {date}.",

  // Role card
  "members.role.title": "Role",
  "members.role.description": "Role changes are written to the audit trail.",
  "members.role.self": "You cannot change your own role. Ask another admin.",
  "members.role.label": "Club role",
  "members.role.submit": "Change role",
  "members.role.pickDifferent": "Pick a different role first.",
  "members.role.changed": "{name} is now {role}.",
  "members.role.ownRole": "You cannot change your own role.",
  "members.role.failed": "We could not change the role.",

  // Password card
  "members.password.title": "Set password",
  "members.password.description": "Gives this member a login, or resets a forgotten one. This is audited.",
  "members.password.new": "New password",
  "members.password.confirm": "Confirm password",
  "members.password.submit": "Set password",
  "members.password.lengthError": "Use 8 to 200 characters.",
  "members.password.mismatch": "Passwords do not match.",
  "members.password.done": "Password set for {name}. Share it privately; they can change it from Settings.",
} as const;

export default members;
