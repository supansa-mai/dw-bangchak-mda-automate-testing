import { test, expect } from '@fixtures';
import { credentialsFor } from '@config/auth';
import { testUsers } from '@config/test-users';
import { expectNewLog } from '@helpers/activity-log';
import type { LogQuery } from '@pages/activity-log.page';
import { TOAST_USER_EDITED } from '@pages/user-management.page';

test.fixme(true, 'Draft: no UAT URL/account yet, locators not verified on the real page');

// Every test turns the same Azure test user off and on, so they must not run at the same time
test.describe.configure({ mode: 'serial' });

const editUserLogs = (): LogQuery => ({
  email: credentialsFor('system-admin').email,
  activity: 'Edit',
  object: 'User',
});

test.beforeEach(async ({ userManagementPage: users }) => {
  await users.goto();
});

test.afterEach(async ({ userManagementPage: users }) => {
  await users.goto();
  await users.ensureActive(testUsers.status);
});

test.describe('TS04-TC01 การปิดการใช้งานผู้ใช้งาน (Inactive)', () => {
  test('ปิด toggle แล้ว Activation = Inactive โดย Role / Company เดิมยังอยู่', async ({
    userManagementPage: users,
    activityLogPage: logs,
  }) => {
    const email = testUsers.status;
    const before = await logs.count(editUserLogs());
    await users.goto();
    await users.search(email);
    const name = await users.cell(email, 'Name').innerText();
    const role = await users.cell(email, 'Role').innerText();
    const company = await users.cell(email, 'Company').innerText();

    await users.setAccountStatus(email, false);

    await expect(users.toast.withTitle(TOAST_USER_EDITED)).toBeVisible();
    await expect(users.cell(email, 'Activation')).toHaveText('Inactive');
    await expect(users.cell(email, 'Role')).toHaveText(role);
    await expect(users.cell(email, 'Company')).toHaveText(company);

    await test.step('บันทึก Edit log Active → Inactive', async () => {
      const log = await expectNewLog(logs, editUserLogs(), before, `changed status of User "${name}"`);
      await expect(log).toContainText('Status: Active → Inactive');
    });
  });

  test('กด Cancel ใน modal ยืนยัน ไม่บันทึก Activation คงเดิม', async ({ userManagementPage: users }) => {
    const email = testUsers.status;
    const dialog = users.editDialog;
    await users.openEditDialog(email);
    await dialog.accountStatusToggle.uncheck();
    await dialog.saveButton.click();

    await dialog.confirm.cancelButton.click();
    await dialog.cancelButton.click();

    await expect(users.cell(email, 'Activation')).toHaveText('Active');
  });
});

test.describe('TS04-TC02 การเปิดการใช้งานผู้ใช้งานอีกครั้ง (Active)', () => {
  test('เปิด toggle แล้ว Activation = Active และยังเป็น Approved', async ({
    userManagementPage: users,
    activityLogPage: logs,
  }) => {
    const email = testUsers.status;
    await users.setAccountStatus(email, false);
    await expect(users.cell(email, 'Activation')).toHaveText('Inactive');
    const name = await users.cell(email, 'Name').innerText();
    const before = await logs.count(editUserLogs());
    await users.goto();

    await users.setAccountStatus(email, true);

    await expect(users.cell(email, 'Activation')).toHaveText('Active');
    await expect(users.cell(email, 'Status')).toHaveText('Approved');

    await test.step('บันทึก Edit log Inactive → Active', async () => {
      const log = await expectNewLog(logs, editUserLogs(), before, `changed status of User "${name}"`);
      await expect(log).toContainText('Status: Inactive → Active');
    });
  });

  // "ผู้ใช้ Pending toggle กดไม่ได้" is the same check as TS03-TC05 in edit-user.spec.ts
});
