// Temporary release switches for LCM public/member experiences.
// Keep campaign data and schema intact while the feature is hidden.
export const LCM_CAMPAIGNS_ENABLED = false;

// Open new brand-contact threads only after edition-2 exhibitors and the
// pre-matching start date are confirmed. Existing thread history and replies
// stay available while new inquiries are paused.
export const LCM_BRAND_CONTACTS_ENABLED = false;
export const LCM_BRAND_CONTACTS_UNAVAILABLE_MESSAGE =
  "参加メーカー確定後、事前マッチング開始時に利用できます。現在は調整中です。";
