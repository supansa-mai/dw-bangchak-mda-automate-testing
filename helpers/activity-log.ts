import { expect, type Locator } from '@playwright/test';
import type { ActivityLogPage, LogQuery } from '@pages/activity-log.page';

/**
 * Waits for a log of `query` whose row has `text`, re-running the search because a log may land a moment after the
 * action. `text` must be something only this test writes (a new company name, a random keyword).
 */
export async function expectLogged(
  logs: ActivityLogPage,
  query: LogQuery,
  text: string | RegExp,
): Promise<Locator> {
  await expect(async () => {
    await logs.goto();
    await logs.query(query);
    await expect(logs.logRows(text).first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  return logs.logRows(text);
}

/**
 * For logs whose text repeats between runs (an Access log, a status change of the same test user): waits until
 * `query` matches more logs than `before` (from `logs.count(query)` taken before the action), then returns the newest
 * row with `text` (logs are listed newest first).
 */
export async function expectNewLog(
  logs: ActivityLogPage,
  query: LogQuery,
  before: number,
  text: string | RegExp,
): Promise<Locator> {
  await expect.poll(() => logs.count(query), { timeout: 30_000 }).toBeGreaterThan(before);
  return logs.logRows(text).first();
}
