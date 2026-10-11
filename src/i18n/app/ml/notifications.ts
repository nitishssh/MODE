import type en from "../en/notifications";

const notifications: Record<keyof typeof en, string> = {
  "notifications.kicker": "നിങ്ങൾ",
  "notifications.kickerSection": "നോട്ടിഫിക്കേഷനുകൾ",
  "notifications.title": "നോട്ടിഫിക്കേഷനുകൾ",
  "notifications.lede": "നിങ്ങൾക്ക് അയച്ച അറിയിപ്പുകളും ഫീസ് ഓർമ്മപ്പെടുത്തലുകളും.",
  "notifications.ledeUnread": "{count} വായിക്കാത്തവ. നിങ്ങൾക്ക് അയച്ച അറിയിപ്പുകളും ഫീസ് ഓർമ്മപ്പെടുത്തലുകളും.",
  "notifications.tabAll": "എല്ലാം",
  "notifications.tabAnnouncements": "അറിയിപ്പുകൾ",
  "notifications.tabDues": "ഫീസ്",
  "notifications.emptyFilterTitle": "ഈ ഫിൽട്ടറിൽ ഒന്നുമില്ല",
  "notifications.emptyFilterBody": "മറ്റൊരു ഫിൽട്ടർ ശ്രമിക്കുക.",
  "notifications.emptyTitle": "ഇതുവരെ നോട്ടിഫിക്കേഷനുകളില്ല",
  "notifications.emptyBody": "പ്രസിദ്ധീകരിച്ച അറിയിപ്പുകളും പുതുക്കൽ ഓർമ്മപ്പെടുത്തലുകളും ഇവിടെ കാണാം.",
  "notifications.kind.announcement": "അറിയിപ്പ്",
  "notifications.kind.dues": "ഫീസ്",
  "notifications.new": "പുതിയത്",
  "notifications.readAnnouncement": "അറിയിപ്പ് വായിക്കുക",
  "notifications.previewNote": "നോട്ടിഫിക്കേഷനുകൾ ആപ്പിനുള്ളിൽ മാത്രം. അനുബന്ധ ഔട്ട്ബോക്സ് വരികൾ സിമുലേറ്റഡ് ആണ്; ഇമെയിലോ WhatsApp-ഓ അയയ്ക്കുന്നില്ല.",
};

export default notifications;
