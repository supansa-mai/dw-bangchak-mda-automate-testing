/**
 * Azure accounts the User Management specs change and then put back (users come from the Azure sync, so tests can't
 * create them). Emails live in .env; each key belongs to one spec file so parallel files never touch the same user.
 */
function emailsFrom(key: string) {
  const emails = (process.env[key] ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
  if (!emails.length) throw new Error(`Missing ${key} in .env (see .env.example)`);
  return emails;
}

export const testUsers = {
  /** Kept Unassigned between runs: edit-user.spec assigns it, then a Super user of BCP rejects it back */
  get unassigned() {
    return emailsFrom('USER_UNASSIGNED_EMAIL')[0];
  },
  /** Approved + Active End User of BCP: edit-user.spec changes Role/Company and puts them back */
  get approved() {
    return emailsFrom('USER_APPROVED_EMAIL')[0];
  },
  /** Approved + Active End User of BCP: account-status.spec turns it off and on again */
  get status() {
    return emailsFrom('USER_STATUS_EMAIL')[0];
  },
  /** 3 users kept Unassigned: approve-reject.spec assigns them to BCP, then rejects them back */
  get review() {
    return emailsFrom('USER_REVIEW_EMAILS');
  },
};
