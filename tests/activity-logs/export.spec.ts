import { test, expect } from '@fixtures';
import { credentialsFor } from '@config/auth';
import { expectNewLog } from '@helpers/activity-log';
import { parseCsv, readDownload } from '@helpers/csv';
import { bangkokYmd } from '@helpers/date';
import { randomLetters } from '@helpers/test-data';
import { LOG_COLUMNS, type LogQuery } from '@pages/activity-log.page';
import { TOAST_API_ERROR } from '@pages/components/toast.component';

test.fixme(true, 'Draft: no UAT URL/account yet, locators not verified on the real page');

// Sheet uses "chanida" + Login; Access logs of the Activity Log page are the ones sure to exist
const OWN_ACCESS = { activity: 'Access', object: 'Activity Log' } satisfies LogQuery;

test.describe('TS03-TC01 ผู้ใช้งานสามารถ Export Activity Log ตามเงื่อนไขการค้นหา', () => {
  test(
    'Export ได้ไฟล์ตามเงื่อนไข ชื่อไฟล์ตามวันที่ และบันทึก Export log',
    { tag: '@smoke' },
    async ({ activityLogPage: logs }) => {
      const { email } = credentialsFor('system-admin');
      const exportQuery = { email, activity: 'Export', object: 'Activity Log' } satisfies LogQuery;
      const exportsBefore = await logs.count(exportQuery);
      const shown = await logs.count({ ...OWN_ACCESS, email });

      const download = await logs.exportCsv();

      const fileName = `MDA_ACTIVITY_LOGS_${bangkokYmd()}.csv`;
      expect(download.suggestedFilename()).toBe(fileName);
      const { header, records } = parseCsv(await readDownload(download));
      expect(header).toEqual([...LOG_COLUMNS]);
      // Every page, not only the one on screen
      expect(records).toHaveLength(shown);
      expect(
        records.every((r) => r.Email === email && r.Activity === 'Access' && r.Object === 'Activity Log'),
      ).toBe(true);

      await test.step('Export log มีชื่อไฟล์และจำนวนแถว', async () => {
        const log = await expectNewLog(logs, exportQuery, exportsBefore, fileName);
        await expect(log).toContainText(`${shown} record(s)`);
      });
    },
  );

  test.describe('Super user BCP', () => {
    test.use({ role: 'super-user' });

    test('ไฟล์มีเฉพาะ activity ของ BCP', async ({ activityLogPage: logs }) => {
      await logs.query({ activity: 'Access' });
      await expect(logs.rows.first()).toBeVisible();

      const download = await logs.exportCsv();

      const { records } = parseCsv(await readDownload(download));
      expect(records.length).toBeGreaterThan(0);
      expect(records.every((r) => r.Company.includes('BCP'))).toBe(true);
    });
  });

  test('ไม่มีผลลัพธ์ ปุ่ม Export กดไม่ได้', async ({ activityLogPage: logs }) => {
    await logs.goto();
    await expect(logs.exportButton).toBeDisabled();

    await logs.searchBy('Email', `auto.${randomLetters(8).toLowerCase()}`);

    await expect(logs.noMatch).toBeVisible();
    await expect(logs.exportButton).toBeDisabled();
  });

  test('สร้างไฟล์ไม่สำเร็จ แสดง toast error กลางของระบบ', async ({ page, activityLogPage: logs }) => {
    await logs.query(OWN_ACCESS);
    await expect(logs.rows.first()).toBeVisible();
    // Verify on the real page: the export request's URL
    await page.route(/export/i, (route) => route.fulfill({ status: 500 }));

    await logs.exportButton.click();

    await expect(logs.toast.withTitle(TOAST_API_ERROR.title)).toContainText(TOAST_API_ERROR.message);
  });
});
