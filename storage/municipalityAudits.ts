export const audits = {
  "informed-citizen": {
    "user-experience": [
      "municipality-menu-structure-match-model",
      "municipality-second-level-pages",
      "municipality-ux-ui-consistency-bootstrap-italia-double-check",
      "municipality-ux-ui-consistency-fonts-check",
      "municipality-controlled-vocabularies",
      "municipality-servizi-structure-match-model",
      "municipality-ux-ui-consistency-theme-version-check",
    ],
    function: [
      "municipality-faq-is-present",
      "municipality-inefficiency-report",
      "municipality-booking-appointment-check",
      "municipality-contacts-assistency",
      "municipality-feedback-element",
    ],
    legislation: [
      "municipality-legislation-cookie-domain-check",
      "municipality-legislation-accessibility-declaration-is-present",
      "municipality-legislation-privacy-is-present",
    ],
    security: ["municipality-security", "municipality-domain"],
  },
  "active-citizen": [
    "municipality-personal-area-security",
    "municipality-subdomain",
  ],
  recommendations: ["municipality-metatag"],
};
