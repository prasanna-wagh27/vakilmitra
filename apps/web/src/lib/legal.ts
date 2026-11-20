/**
 * Business details printed on the policy pages (Terms, Privacy, Refunds, Delivery, Contact).
 * Fill in every null before applying for live Razorpay payments; until then the pages show
 * "to be added" and a draft notice. Keep these the same as the seller details on invoices.
 */
export const LEGAL = {
  /** Legal name of the business: a company ("… Private Limited"), LLP, or the proprietor's name. */
  operator: null as string | null,
  /** Registered or business address, with PIN code. */
  address: null as string | null,
  supportEmail: null as string | null,
  supportPhone: null as string | null,
  /** Grievance Officer under the DPDP Act and IT Rules. */
  grievanceOfficer: null as string | null,
  grievanceEmail: null as string | null,
  /** City whose courts hear disputes, e.g. "Pune". */
  courtsCity: null as string | null,
  /** Date these policies last changed (YYYY-MM-DD). */
  updated: "2026-11-20",
};

export const legalComplete = () => Object.values(LEGAL).every((v) => v !== null);
