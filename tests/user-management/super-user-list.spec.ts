import { test, expect, todo } from '@fixtures';
import { credentialsFor } from '@config/auth';
import { uniqueName } from '@helpers/test-data';
import { expectLogged, expectNewLog } from '@helpers/activity-log';
import { ActivityLogPage, type LogQuery } from '@pages/activity-log.page';
import { COLUMNS } from '@pages/user-management.page';

test.fixme(true, 'Draft: no UAT URL/account yet, locators not verified on the real page');

// The seeded Super user belongs to BCP only
test.use({ role: 'super-user' });
const OWN_COMPANY = 'BCP';

test.beforeEach(async ({ userManagementPage: users }) => {
  await users.goto();
});

test.describe('TS06-TC01 Super user สามารถเห็นหน้ารายการผู้ใช้งานของบริษัทตัวเอง', () => {
  test(
    'เปิดจากเมนู Sidebar แล้วเห็นหน้ารายการผู้ใช้ครบ',
    { tag: '@smoke' },
    async ({ page, userManagementPage: users }) => {
      await page.goto('/');
      await users.sidebar.open('User Management');

      await expect(users.bulk.selected).toHaveText('Selected 0 items');
      await expect(users.bulk.approveButton).toBeDisabled();
      await expect(users.bulk.rejectButton).toBeDisabled();
      await expect(users.searchInput).toBeVisible();
      await expect(users.statusFilter.trigger).toBeVisible();
      await expect(users.roleFilter.trigger).toBeVisible();
      await expect(users.companyFilter.trigger).toBeVisible();
      await expect(users.bulk.selectAll).toBeVisible();
      for (const column of COLUMNS) await expect(users.columnHeader(column)).toBeVisible();
      await expect(users.uploadBatchButton).toBeHidden();
    },
  );

  test('ไม่เห็นผู้ใช้ Unassigned และเรียง Pending ก่อน Approved', async ({ userManagementPage: users }) => {
    await expect(users.rows.first()).toBeVisible();

    const statuses = await users.columnTexts('Status');

    expect(statuses).not.toContain('-');
    expect(statuses.slice(statuses.indexOf('Approved'))).not.toContain('Pending');
  });

  test('เห็นเฉพาะผู้ใช้ที่มี Company ร่วมกัน', async ({ userManagementPage: users }) => {
    await users.companyFilter.trigger.click();

    await expect(users.companyFilter.options).toHaveText([OWN_COMPANY]);
    // A user with more than 2 companies shows "+n", so BCP may be hidden in the badge; only those that show all are checked
    const companies = (await users.columnTexts('Company')).filter((c) => !/\+\d+/.test(c));
    expect(companies.every((c) => c.includes(OWN_COMPANY))).toBe(true);
  });

  test('ผู้ใช้ Approved ไม่มีปุ่มแก้ไข checkbox และปุ่ม ✕ ✓', async ({ userManagementPage: users }) => {
    const { email } = credentialsFor('super-user');
    await users.search(email);

    await expect(users.cell(email, 'Status')).toHaveText('Approved');
    await expect(users.editButtonOf(email)).toBeHidden();
    await expect(users.checkboxOf(email)).toBeHidden();
    await expect(users.approveButtonOf(email)).toBeHidden();
    await expect(users.rejectButtonOf(email)).toBeHidden();
  });

  // "ผู้ใช้ Pending มี checkbox และปุ่ม ✕ ✓" is in approve-reject.spec.ts, which makes its own Pending user
  todo('ผู้ใช้ Pending ที่มี BCP และ BCPG แสดงให้ Super user ทั้ง 2 บริษัท (รอบัญชี Super user BCPG ใน .env)');
});

test.describe('TS06-TC02 การค้นหาและกรองผู้ใช้งานในบริษัท', () => {
  test('ตัวกรอง Role ไม่มี System Admin', async ({ userManagementPage: users }) => {
    await users.roleFilter.trigger.click();

    await expect(users.roleFilter.options).toHaveText(['End User', 'Super User', 'Uploader']);
  });

  test('กรอง Status = Pending แสดงเฉพาะ Pending', async ({ userManagementPage: users }) => {
    await users.statusFilter.select('Pending');

    await expect
      .poll(async () => (await users.columnTexts('Status')).every((status) => status === 'Pending'))
      .toBe(true);
  });

  test('ค้นหาด้วยอีเมลบางส่วน แสดงเฉพาะผู้ใช้ที่ตรง', async ({ userManagementPage: users }) => {
    const { email } = credentialsFor('super-user');
    const keyword = email.split('@')[0].slice(0, 5);

    await users.search(keyword);

    await expect(users.row(email)).toBeVisible();
    const emails = await users.columnTexts('Email');
    const names = await users.columnTexts('Name');
    expect(emails.every((e, i) => `${e} ${names[i]}`.toLowerCase().includes(keyword.toLowerCase()))).toBe(
      true,
    );
  });

  test('กรอง Role = Super User แสดงเฉพาะ Super User', async ({ userManagementPage: users }) => {
    await users.roleFilter.select('Super User');

    await expect.poll(async () => new Set(await users.columnTexts('Role'))).toEqual(new Set(['Super User']));
  });

  test('ค้นหาคำที่ไม่มีในระบบ แสดง Search not found', async ({ userManagementPage: users }) => {
    await users.search(uniqueName('NotFound'));

    await expect(users.emptyState.title).toBeVisible();
    await expect(users.rows).toHaveCount(0);
  });

  test('เลือกค่าใหม่ แทนค่าเดิมในตัวกรอง', async ({ userManagementPage: users }) => {
    await users.statusFilter.select('Pending');

    await users.statusFilter.select('Approved');

    await expect(users.statusFilter.trigger).toContainText('Approved');
    await expect(users.statusFilter.trigger).not.toContainText('Pending');
    await expect.poll(async () => new Set(await users.columnTexts('Status'))).toEqual(new Set(['Approved']));
  });

  // Verify on the real page: the single-select filters still have a clear (x) button
  test('กดกากบาท ล้างตัวเลือกกลับเป็นค่าเริ่มต้น', async ({ userManagementPage: users }) => {
    await users.statusFilter.select('Approved');

    await users.statusFilter.clearButton.click();

    await expect(users.statusFilter.trigger).toContainText('All Statuses');
  });

  test('บันทึก Access และ Search log ของ Super user', async ({ userManagementPage: users, openAs }) => {
    const actor = credentialsFor('super-user').email;
    const adminLogs = new ActivityLogPage(await openAs('system-admin'));
    const access = { email: actor, activity: 'Access', object: 'User management' } satisfies LogQuery;
    const before = await adminLogs.count(access);
    const keyword = uniqueName('NotFound');

    await users.goto();
    await users.search(keyword);
    await expect(users.emptyState.title).toBeVisible();

    await expect(await expectNewLog(adminLogs, access, before, 'accessed User management')).toBeVisible();
    const search = await expectLogged(
      adminLogs,
      { email: actor, activity: 'Search', object: 'User management' },
      `"${keyword}"`,
    );
    await expect(search).toContainText('found 0 result(s)');
  });
});
