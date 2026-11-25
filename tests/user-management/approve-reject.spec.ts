import type { Page } from '@playwright/test';
import { test, expect, todo } from '@fixtures';
import { credentialsFor, type Role } from '@config/auth';
import { testUsers } from '@config/test-users';
import { expectNewLog } from '@helpers/activity-log';
import { ActivityLogPage, type LogQuery } from '@pages/activity-log.page';
import { TOAST_USER_APPROVED, TOAST_USER_REJECTED, UserManagementPage } from '@pages/user-management.page';

test.fixme(true, 'Draft: no UAT URL/account yet, locators not verified on the real page');

// The tests share three Azure test users and put them back afterwards, so they must not run at the same time
test.describe.configure({ mode: 'serial' });
test.use({ role: 'super-user' });

const superUserLogs = (activity: 'Approve' | 'Reject'): LogQuery => ({
  email: credentialsFor('super-user').email,
  activity,
  object: 'User',
});

/** A System Admin assigns `emails` to `role` of BCP, so the Super user (BCP) sees them as Pending */
async function makePending(
  openAs: (role: Role) => Promise<Page>,
  emails: string[],
  role: 'End User' | 'Super User' = 'End User',
) {
  const admin = new UserManagementPage(await openAs('system-admin'));
  await admin.goto();
  for (const email of emails) await admin.editUser(email, { role, companies: ['BCP'] });
}

/** Users from the approve pool that are still Unassigned; approving them uses them up for good */
async function takeFromApprovePool(openAs: (role: Role) => Promise<Page>, count: number) {
  const admin = new UserManagementPage(await openAs('system-admin'));
  await admin.goto();
  return admin.takeUnassigned(testUsers.approvePool, count);
}

test.afterEach(async ({ userManagementPage: users }) => {
  await users.goto();
  for (const email of testUsers.review) await users.rejectIfPending(email);
});

test.describe('TS06-TC01 Super user สามารถเห็นหน้ารายการผู้ใช้งานของบริษัทตัวเอง (ผู้ใช้ Pending)', () => {
  test('ผู้ใช้ Pending มี checkbox และปุ่ม ✕ ✓ แต่ไม่มีปุ่มแก้ไข', async ({ userManagementPage: users, openAs }) => {
    const [email] = testUsers.review;
    await makePending(openAs, [email]);
    await users.goto();

    await users.search(email);

    await expect(users.cell(email, 'Status')).toHaveText('Pending');
    await expect(users.checkboxOf(email)).toBeVisible();
    await expect(users.approveButtonOf(email)).toBeVisible();
    await expect(users.rejectButtonOf(email)).toBeVisible();
    await expect(users.editButtonOf(email)).toBeHidden();
  });
});

test.describe('TS07-TC01 Super user อนุมัติผู้ใช้งานทีละคน', () => {
  test('กด ✓ แสดง modal Approve และกด Cancel แล้วยังเป็น Pending', async ({
    userManagementPage: users,
    openAs,
  }) => {
    const [email] = testUsers.review;
    await makePending(openAs, [email]);
    await users.goto();
    await users.search(email);

    await users.approveButtonOf(email).click();

    await expect(users.approveDialog.root).toHaveAccessibleName('Approve this user?');
    await expect(users.approveDialog.root).toContainText('This user will have access immediately.');
    await users.approveDialog.cancelButton.click();
    await expect(users.approveDialog.root).toBeHidden();
    await expect(users.cell(email, 'Status')).toHaveText('Pending');
  });

  // Approving a new Super user of BCP also covers "Super user อนุมัติ Super user บริษัทเดียวกันได้"
  test(
    'กด Approve แล้ว Approved + Active และบันทึก Approve log',
    { tag: '@uses-up-users' },
    async ({ userManagementPage: users, openAs }) => {
      const [email] = await takeFromApprovePool(openAs, 1);
      await makePending(openAs, [email], 'Super User');
      const adminLogs = new ActivityLogPage(await openAs('system-admin'));
      const before = await adminLogs.count(superUserLogs('Approve'));
      await users.goto();
      await users.search(email);

      await users.approveButtonOf(email).click();
      await users.approveDialog.confirmButton.click();

      await expect(users.toast.withTitle(TOAST_USER_APPROVED)).toBeVisible();
      await expect(users.cell(email, 'Status')).toHaveText('Approved');
      await expect(users.cell(email, 'Activation')).toHaveText('Active');

      await test.step('System Admin เห็น Approved + Active', async () => {
        const admin = new UserManagementPage(await openAs('system-admin'));
        await admin.goto();
        await admin.search(email);
        await expect(admin.cell(email, 'Status')).toHaveText('Approved');
        await expect(admin.cell(email, 'Activation')).toHaveText('Active');
      });

      await test.step('บันทึก Approve log', async () => {
        const log = await expectNewLog(adminLogs, superUserLogs('Approve'), before, email);
        await expect(log).toContainText('approved user');
        await expect(log).toContainText('Pending → Approve (Role Super User');
      });
    },
  );
});

test.describe('TS07-TC02 Super user อนุมัติผู้ใช้งานหลายคนพร้อมกัน', () => {
  test('เลือก 3 คน แสดง "Selected 3 items" และ modal Approve 3 users', async ({
    userManagementPage: users,
    openAs,
  }) => {
    const emails = testUsers.review;
    await makePending(openAs, emails);
    await users.goto();
    await users.statusFilter.select('Pending');
    await expect(users.bulk.approveButton).toBeDisabled();

    for (const email of emails) await users.checkboxOf(email).check();

    await expect(users.bulk.selected).toHaveText('Selected 3 items');
    await users.bulk.approveButton.click();
    await expect(users.approveDialog.root).toHaveAccessibleName('Approve 3 users?');
    await expect(users.approveDialog.root).toContainText('These users will have access immediately.');
    await expect(users.approveDialog.confirmButton).toHaveText('Approve (3)');
    await users.approveDialog.cancelButton.click();
    for (const email of emails) await expect(users.cell(email, 'Status')).toHaveText('Pending');
  });

  test('checkbox หัวตาราง เลือกเฉพาะแถว Pending ในหน้านั้น', async ({ userManagementPage: users, openAs }) => {
    await makePending(openAs, testUsers.review);
    await users.goto();
    const pendingRows = users.rows.filter({ has: users.table.getByRole('checkbox') });

    await users.bulk.selectAll.check();

    await expect(users.bulk.selected).toHaveText(
      new RegExp(`^Selected ${await pendingRows.count()} items?$`),
    );
  });

  test(
    'กด Approve (3) แล้วทั้ง 3 คน Approved + Active และบันทึก log รวม 1 รายการ',
    { tag: '@uses-up-users' },
    async ({ userManagementPage: users, openAs }) => {
      const emails = await takeFromApprovePool(openAs, 3);
      await makePending(openAs, emails);
      const adminLogs = new ActivityLogPage(await openAs('system-admin'));
      const before = await adminLogs.count(superUserLogs('Approve'));
      await users.goto();
      await users.statusFilter.select('Pending');
      for (const email of emails) await users.checkboxOf(email).check();

      await users.bulk.approveButton.click();
      await users.approveDialog.confirmButton.click();

      await expect(users.toast.withTitle(TOAST_USER_APPROVED)).toBeVisible();
      await expect(users.bulk.selected).toHaveText('Selected 0 items');
      await users.goto();
      for (const email of emails) {
        await users.search(email);
        await expect(users.cell(email, 'Status')).toHaveText('Approved');
        await expect(users.cell(email, 'Activation')).toHaveText('Active');
      }

      await test.step('Approve log 1 รายการรวมทั้ง 3 คน', async () => {
        const log = await expectNewLog(adminLogs, superUserLogs('Approve'), before, 'approved 3 user(s)');
        for (const email of emails) await expect(log).toContainText(email);
        await expect(log).toContainText('success 3, failed 0');
      });
    },
  );

  // Sheet has a Super user of BCPG approve first; a second window of the same Super user leaves the page just as stale
  test(
    'อนุมัติพร้อมกัน 2 หน้าจอ: มีคนอนุมัติไปก่อน ไม่บันทึกและให้ Refresh',
    { tag: '@uses-up-users' },
    async ({ userManagementPage: users, openAs }) => {
      const [approvedFirst] = await takeFromApprovePool(openAs, 1);
      const [stillPending, alsoPending] = testUsers.review;
      const emails = [approvedFirst, stillPending, alsoPending];
      await makePending(openAs, emails);
      await users.goto();
      await users.statusFilter.select('Pending');
      for (const email of emails) await users.checkboxOf(email).check();

      const otherWindow = new UserManagementPage(await openAs('super-user'));
      await otherWindow.goto();
      await otherWindow.search(approvedFirst);
      await otherWindow.approveButtonOf(approvedFirst).click();
      await otherWindow.approveDialog.confirmButton.click();
      await expect(otherWindow.cell(approvedFirst, 'Status')).toHaveText('Approved');

      await users.bulk.approveButton.click();
      await users.approveDialog.confirmButton.click();

      await expect(users.statusUpdatedDialog.root).toBeVisible();
      await users.statusUpdatedDialog.refreshButton.click();
      for (const email of [stillPending, alsoPending]) {
        await users.search(email);
        await expect(users.cell(email, 'Status')).toHaveText('Pending');
      }
    },
  );

  todo('Super user คนหนึ่งอนุมัติ อีกคนปฏิเสธคนเดียวกันพร้อมกัน (ข้อความแจ้งใน sheet ยังเป็น draft)');
});

test.describe('TS08-TC01 Super user ปฏิเสธผู้ใช้งาน', () => {
  test('กด ✕ แสดง modal Reject และกด Cancel แล้วยังเป็น Pending', async ({
    userManagementPage: users,
    openAs,
  }) => {
    const [email] = testUsers.review;
    await makePending(openAs, [email]);
    await users.goto();
    await users.search(email);

    await users.rejectButtonOf(email).click();

    await expect(users.rejectDialog.root).toHaveAccessibleName('Reject this user?');
    await expect(users.rejectDialog.root).toContainText('The user will be denied access to the system.');
    await users.rejectDialog.cancelButton.click();
    await expect(users.cell(email, 'Status')).toHaveText('Pending');
  });

  test(
    'กด Reject แล้วผู้ใช้หายจากรายการ และกลับเป็น Unassigned',
    { tag: '@smoke' },
    async ({ userManagementPage: users, openAs }) => {
      const [email] = testUsers.review;
      await makePending(openAs, [email]);
      const adminLogs = new ActivityLogPage(await openAs('system-admin'));
      const before = await adminLogs.count(superUserLogs('Reject'));
      await users.goto();

      await users.rejectUser(email);

      await expect(users.toast.withTitle(TOAST_USER_REJECTED)).toBeVisible();
      await expect(users.row(email)).toBeHidden();

      await test.step('System Admin เห็น Company, Role, Status เป็น "-" และ Inactive', async () => {
        const admin = new UserManagementPage(await openAs('system-admin'));
        await admin.goto();
        await admin.search(email);
        for (const column of ['Company', 'Role', 'Status'] as const) {
          await expect(admin.cell(email, column)).toHaveText('-');
        }
        await expect(admin.cell(email, 'Activation')).toHaveText('Inactive');
      });

      await test.step('System Admin ส่งขออนุมัติใหม่ได้ เป็น Pending อีกครั้ง', async () => {
        await makePending(openAs, [email]);
        await users.goto();
        await users.search(email);
        await expect(users.cell(email, 'Status')).toHaveText('Pending');
      });

      await test.step('บันทึก Reject log', async () => {
        const log = await expectNewLog(adminLogs, superUserLogs('Reject'), before, email);
        await expect(log).toContainText('rejected user');
        await expect(log).toContainText('Pending → Reject');
      });
    },
  );
});

test.describe('TS08-TC02 Super user ปฏิเสธผู้ใช้งานหลายคนพร้อมกัน', () => {
  test('เลือก 3 คนแล้ว Reject ทั้งหมดหายจากรายการ และบันทึก log รวม 1 รายการ', async ({
    userManagementPage: users,
    openAs,
  }) => {
    const emails = testUsers.review;
    await makePending(openAs, emails);
    const adminLogs = new ActivityLogPage(await openAs('system-admin'));
    const before = await adminLogs.count(superUserLogs('Reject'));
    await users.goto();
    await users.statusFilter.select('Pending');
    for (const email of emails) await users.checkboxOf(email).check();

    await users.bulk.rejectButton.click();
    await expect(users.rejectDialog.root).toHaveAccessibleName('Reject 3 users?');
    await expect(users.rejectDialog.root).toContainText('These users will be denied access to the system.');
    await users.rejectDialog.confirmButton.click();

    await expect(users.toast.withTitle(TOAST_USER_REJECTED)).toBeVisible();
    for (const email of emails) await expect(users.row(email)).toBeHidden();

    await test.step('Reject log 1 รายการรวมทั้ง 3 คน', async () => {
      const log = await expectNewLog(adminLogs, superUserLogs('Reject'), before, 'rejected 3 user(s)');
      for (const email of emails) await expect(log).toContainText(email);
      await expect(log).toContainText('success 3, failed 0');
    });
  });
});
