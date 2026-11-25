import { test, expect, todo } from '@fixtures';
import { credentialsFor } from '@config/auth';
import { csvFile, parseCsv, readDownload } from '@helpers/csv';
import { randomLetters } from '@helpers/test-data';
import { expectNewLog } from '@helpers/activity-log';
import type { LogQuery } from '@pages/activity-log.page';

test.fixme(true, 'Draft: no UAT URL/account yet, locators not verified on the real page');

const HEADER = ['Email', 'Company', 'Role'];
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB counted as 1024 × 1024 bytes (agreed 25 Nov; dev not confirmed yet)
// Error texts follow Figma (agreed over Jira); these are still the sheet's, not yet checked against Figma
const INVALID_FORMAT = 'Invalid file format. Only CSV files are accepted.';
const INVALID_SIZE = 'Invalid file size. File size should be smaller than 25 MB.';

/** An existing user; files that are only checked (never confirmed) can name anyone */
const existingEmail = () => credentialsFor('end-user').email;
const unknownEmail = () => `auto.${randomLetters(8).toLowerCase()}@example.com`;

/** A CSV of `size` bytes: one valid row padded with blank lines */
function csvOfSize(size: number) {
  const file = csvFile('users.csv', [HEADER, [existingEmail(), 'BCP', 'End User']]);
  return { ...file, buffer: Buffer.concat([file.buffer, Buffer.alloc(size - file.buffer.length, '\n')]) };
}

test.beforeEach(async ({ userManagementPage: users }) => {
  await users.goto();
  await users.uploadBatchButton.click();
});

test.describe('TS05-TC01 System Admin สามารถ Upload to Edit Batch ผู้ใช้งานได้', () => {
  test('เปิด modal Upload to Edit Batch เห็นส่วนประกอบครบ', async ({ userManagementPage: users }) => {
    const dialog = users.batchDialog;

    await expect(dialog.root).toBeVisible();
    await expect(dialog.root).toContainText('CSV (MAX. 25MB)');
    await expect(dialog.browseButton).toBeVisible();
    await expect(dialog.downloadTemplateButton).toBeVisible();
    await expect(dialog.cancelButton).toBeVisible();
    await expect(dialog.uploadButton).toBeDisabled();
  });

  test('Download Template ได้ไฟล์ CSV คอลัมน์ Email, Company, Role', async ({ userManagementPage: users }) => {
    const download = await users.batchDialog.downloadTemplate();

    expect(download.suggestedFilename()).toBe('MDA_USER_ROLE_UPDATE_TEMPLATE.csv');
    expect(parseCsv(await readDownload(download)).header).toEqual(HEADER);
  });

  test('บันทึก Export log ตอนดาวน์โหลด template', async ({
    userManagementPage: users,
    activityLogPage: logs,
  }) => {
    const query = {
      email: credentialsFor('system-admin').email,
      activity: 'Export',
      object: 'Template',
    } satisfies LogQuery;
    const before = await logs.count(query);
    await users.goto();
    await users.uploadBatchButton.click();

    await users.batchDialog.downloadTemplate();

    const log = await expectNewLog(logs, query, before, 'downloaded template "User batch update template"');
    await expect(log).toContainText('MDA_USER_ROLE_UPDATE_TEMPLATE.csv');
  });
});

test.describe('TS05-TC02 การแก้ไขผู้ใช้งานแบบกลุ่มสำเร็จ - ข้อมูลถูกต้องทุกแถว', () => {
  test('ไฟล์ถูกต้อง กด Upload แสดงสรุปจำนวนต่อ Role และกด Cancel ไม่บันทึก', async ({
    userManagementPage: users,
  }) => {
    const dialog = users.batchDialog;
    await dialog.choose(csvFile('users.csv', [HEADER, [existingEmail(), 'BCP', 'End User']]));
    await expect(dialog.validFileIcon).toBeVisible();

    await dialog.uploadButton.click();

    await expect(dialog.confirm.root).toBeVisible();
    await expect(dialog.summaryCount('End User')).toHaveText('1');
    await expect(dialog.summaryCount('Total')).toHaveText('1');
    await dialog.confirm.cancelButton.click();
    await expect(dialog.confirm.root).toBeHidden();
    await expect(dialog.root).toBeVisible();
  });

  todo(
    'Confirm แล้วผู้ใช้ได้ Role/Company ตามไฟล์: Unassigned → Pending, System Admin → Approved (รอ test user ของ spec นี้ใน .env)',
  );
  todo('ผู้ใช้ Pending ถูกแทนค่าใหม่ / ผู้ใช้ Approved บันทึกทันที (รอ test user ของ spec นี้ใน .env)');
  todo('บันทึก Edit log 1 รายการต่อไฟล์ (รอ test user ของ spec นี้ใน .env)');
});

test.describe('TS05-TC03 ตรวจสอบไฟล์ที่มีข้อมูลผิดพลาด', () => {
  // Row numbers count the header as row 1, as in the sheet ("แถว 2" = first data row)
  const invalidFiles: { title: string; rows: () => string[][]; error: RegExp }[] = [
    {
      title: 'Email ที่ไม่มีในระบบ',
      rows: () => [HEADER, [unknownEmail(), 'BCP', 'End User'], [existingEmail(), 'BCP', 'End User']],
      error: /Incorrect Data.*Row 2\b/,
    },
    {
      title: 'Company ที่ไม่มีในระบบ',
      rows: () => [HEADER, [existingEmail(), 'XYZ', 'End User']],
      error: /Row 2\b/,
    },
    {
      title: 'Role ที่ไม่ใช่ 1 ใน 4 Role',
      rows: () => [HEADER, [existingEmail(), 'BCP', 'Manager']],
      error: /Row 2\b/,
    },
    {
      title: 'Role 2 ค่าในแถวเดียว',
      rows: () => [HEADER, [existingEmail(), 'BCP', 'End User, Super User']],
      error: /Row 2\b/,
    },
    {
      title: 'ช่องว่างและ System Admin ใส่ Company ระบุครบทุกแถว',
      rows: () => [
        HEADER,
        ['', 'BCP', 'End User'],
        [existingEmail(), '', 'End User'],
        [existingEmail(), 'BCP', ''],
        [existingEmail(), 'BCP', 'System Admin'],
      ],
      error: /Incorrect Data: 4 Rows.*2.*3.*4.*5/,
    },
    {
      title: 'Email ซ้ำ 2 แถว',
      rows: () => [HEADER, [existingEmail(), 'BCP', 'End User'], [existingEmail(), 'BCPG', 'End User']],
      error: /Incorrect Data: 2 Rows/,
    },
    {
      title: 'Company / Role ตัวพิมพ์หรือเว้นวรรคไม่ตรง',
      rows: () => [
        HEADER,
        [existingEmail(), 'BCP ', 'End User'],
        [existingEmail(), 'bcp', 'End User'],
        [existingEmail(), 'BCP', 'end user'],
      ],
      error: /Incorrect Data: 3 Rows/,
    },
  ];

  for (const { title, rows, error } of invalidFiles) {
    test(`${title} ไม่รับทั้งไฟล์`, async ({ userManagementPage: users }) => {
      const dialog = users.batchDialog;

      await dialog.choose(csvFile('users.csv', rows()));

      await expect(dialog.incorrectDataError).toHaveText(error);
      await expect(dialog.reUploadButton).toBeVisible();
      await expect(dialog.uploadButton).toBeDisabled();
    });
  }

  test('Re-Upload ไฟล์ที่ถูกต้อง ข้อความ error หายและ Upload กดได้', async ({ page, userManagementPage: users }) => {
    const dialog = users.batchDialog;
    await dialog.choose(csvFile('users.csv', [HEADER, [existingEmail(), 'XYZ', 'End User']]));
    await expect(dialog.incorrectDataError).toBeVisible();

    const fileChooser = page.waitForEvent('filechooser');
    await dialog.reUploadButton.click();
    await (await fileChooser).setFiles(csvFile('users.csv', [HEADER, [existingEmail(), 'BCP', 'End User']]));

    await expect(dialog.incorrectDataError).toBeHidden();
    await expect(dialog.uploadButton).toBeEnabled();
  });

  test('ลบไฟล์ กลับสู่สถานะเริ่มต้น', async ({ userManagementPage: users }) => {
    const dialog = users.batchDialog;
    await dialog.choose(csvFile('users.csv', [HEADER, [existingEmail(), 'XYZ', 'End User']]));

    await dialog.removeFileButton.click();

    await expect(dialog.fileName('users.csv')).toBeHidden();
    await expect(dialog.incorrectDataError).toBeHidden();
    await expect(dialog.uploadButton).toBeDisabled();
  });

  todo('Template ไม่ถูกต้อง (Expected ใน sheet ยังไม่บอกว่าต่างจากคอลัมน์สลับลำดับอย่างไร)');
});

test.describe('TS05-TC04 ตรวจสอบประเภทและขนาดไฟล์', () => {
  test('ไฟล์ .xlsx ไม่รับ', async ({ userManagementPage: users }) => {
    const dialog = users.batchDialog;

    await dialog.choose({
      name: 'users.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('not a csv'),
    });

    await expect(dialog.errorText(INVALID_FORMAT)).toBeVisible();
    await expect(dialog.uploadButton).toBeDisabled();
  });

  test('ไฟล์ขนาด 25 MB พอดี รับไฟล์', async ({ userManagementPage: users }) => {
    const dialog = users.batchDialog;

    await dialog.choose(csvOfSize(MAX_SIZE));

    await expect(dialog.fileName('users.csv')).toBeVisible();
    await expect(dialog.errorText(INVALID_SIZE)).toBeHidden();
  });

  test('ไฟล์เกิน 25 MB ไม่รับ', async ({ userManagementPage: users }) => {
    const dialog = users.batchDialog;

    await dialog.choose(csvOfSize(MAX_SIZE + 1));

    await expect(dialog.errorText(INVALID_SIZE)).toBeVisible();
    await expect(dialog.uploadButton).toBeDisabled();
  });

  test('ไฟล์มีแค่ header หรือไฟล์ว่าง ไม่รับ', async ({ userManagementPage: users }) => {
    const dialog = users.batchDialog;

    for (const file of [csvFile('header-only.csv', [HEADER]), csvFile('empty.csv', [])]) {
      await test.step(file.name, async () => {
        await dialog.choose(file);
        await expect(dialog.incorrectDataError).toBeVisible();
        await expect(dialog.uploadButton).toBeDisabled();
        await dialog.removeFileButton.click();
      });
    }
  });

  test('คอลัมน์สลับลำดับหรือชื่อไม่ตรง template ไม่รับ', async ({ userManagementPage: users }) => {
    const dialog = users.batchDialog;
    const files = [
      csvFile('swapped.csv', [
        ['Email', 'Role', 'Company'],
        [existingEmail(), 'End User', 'BCP'],
      ]),
      csvFile('renamed.csv', [
        ['E-mail', 'Company', 'Role'],
        [existingEmail(), 'BCP', 'End User'],
      ]),
    ];

    for (const file of files) {
      await test.step(file.name, async () => {
        await dialog.choose(file);
        await expect(dialog.incorrectDataError).toBeVisible();
        await dialog.removeFileButton.click();
      });
    }
  });

  test('CSV UTF-8 จาก Excel (มี BOM) อ่านได้ถูกต้อง', async ({ userManagementPage: users }) => {
    const dialog = users.batchDialog;

    await dialog.choose(csvFile('excel.csv', [HEADER, [existingEmail(), 'BCP', 'End User']], { bom: true }));

    await expect(dialog.validFileIcon).toBeVisible();
    await expect(dialog.uploadButton).toBeEnabled();
  });
});
