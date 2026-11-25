import type { Page } from '@playwright/test';
import { test, expect, todo } from '@fixtures';
import type { Role } from '@config/auth';
import { testUsers } from '@config/test-users';
import { TOAST_USER_REJECTED, UserManagementPage } from '@pages/user-management.page';

test.fixme(true, 'Draft: no UAT URL/account yet, locators not verified on the real page');

// The tests share three Azure test users and put them back afterwards, so they must not run at the same time
test.describe.configure({ mode: 'serial' });
test.use({ role: 'super-user' });

/** A System Admin assigns `emails` to End User of BCP, so the Super user (BCP) sees them as Pending */
async function makePending(openAs: (role: Role) => Promise<Page>, emails: string[]) {
  const admin = new UserManagementPage(await openAs('system-admin'));
  await admin.goto();
  for (const email of emails) await admin.editUser(email, { role: 'End User', companies: ['BCP'] });
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

  todo('กด Approve แล้ว Approved + Active (รอ dev reset: ผู้ใช้ที่อนุมัติแล้วย้อนกลับไม่ได้)');
  todo('Super user อนุมัติ Super user บริษัทเดียวกันได้ (รอ dev reset ผู้ใช้ที่อนุมัติแล้ว)');
  todo('บันทึก Approve log (รอ ActivityLogPage)');
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

  todo('กด Approve (3) แล้วทั้ง 3 คน Approved + Active (รอ dev reset ผู้ใช้ที่อนุมัติแล้ว)');
  todo(
    'Super user 2 บริษัทอนุมัติพร้อมกัน บันทึกเฉพาะที่ยัง Pending (รอ Super user BCPG และ dev reset; Expected ยังไม่ชัด)',
  );
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
    },
  );

  todo('บันทึก Reject log พร้อมเหตุผล (รอ ActivityLogPage; ช่องเหตุผลใน modal ยังไม่ยืนยัน)');
});

test.describe('TS08-TC02 Super user ปฏิเสธผู้ใช้งานหลายคนพร้อมกัน', () => {
  test('เลือก 3 คนแล้ว Reject ทั้งหมดหายจากรายการ', async ({ userManagementPage: users, openAs }) => {
    const emails = testUsers.review;
    await makePending(openAs, emails);
    await users.goto();
    await users.statusFilter.select('Pending');
    for (const email of emails) await users.checkboxOf(email).check();

    await users.bulk.rejectButton.click();
    await expect(users.rejectDialog.root).toHaveAccessibleName('Reject 3 users?');
    await expect(users.rejectDialog.root).toContainText('These users will be denied access to the system.');
    await users.rejectDialog.confirmButton.click();

    await expect(users.toast.withTitle(TOAST_USER_REJECTED)).toBeVisible();
    for (const email of emails) await expect(users.row(email)).toBeHidden();
  });

  todo('บันทึก Reject log 1 รายการรวม 3 คน (รอ ActivityLogPage)');
});
