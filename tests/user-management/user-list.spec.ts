import { test, expect, todo } from '@fixtures';
import { credentialsFor } from '@config/auth';
import { uniqueName } from '@helpers/test-data';
import { isSorted } from '@helpers/table';
import { COLUMNS, ROLE_NAMES, type Column } from '@pages/user-management.page';

test.fixme(true, 'Draft: no UAT URL/account yet, locators not verified on the real page');

/** Default order of the Status column: Unassigned ("-") first, then Pending, then Approved */
const STATUS_ORDER = ['-', 'Pending', 'Approved'];

test.beforeEach(async ({ userManagementPage: users }) => {
  await users.goto();
});

test.describe('TS01-TC01 System Admin สามารถเห็นหน้า User Management', () => {
  test(
    'เปิดจากเมนู Sidebar แล้วเห็นหน้า User Management ครบ',
    { tag: '@smoke' },
    async ({ page, userManagementPage: users }) => {
      await page.goto('/');
      await users.sidebar.open('User Management');

      await expect(page).toHaveURL(/user-management/);
      await expect(users.heading).toBeVisible();
      await expect(users.uploadBatchButton).toBeVisible();
      await expect(users.searchInput).toBeVisible();
      await expect(users.statusFilter.trigger).toBeVisible();
      await expect(users.roleFilter.trigger).toBeVisible();
      await expect(users.companyFilter.trigger).toBeVisible();
      for (const column of COLUMNS) await expect(users.columnHeader(column)).toBeVisible();
      await expect(users.pagination.rowsPerPage).toContainText('20');
    },
  );

  test('ผู้ใช้ตั้งต้น System Admin และ Super user เป็น Approved และ Active', async ({
    userManagementPage: users,
  }) => {
    for (const role of ['system-admin', 'super-user'] as const) {
      const { email } = credentialsFor(role);

      await test.step(role, async () => {
        await users.search(email);
        await expect(users.cell(email, 'Status')).toHaveText('Approved');
        await expect(users.cell(email, 'Activation')).toHaveText('Active');
      });
    }
  });

  test('เห็นผู้ใช้งานทุกบริษัท รวมผู้ใช้ที่ยังไม่มี Company', async ({ userManagementPage: users }) => {
    // Unassigned users sort first (TS01-TC02), so the first page has at least one when any exist
    await expect.poll(() => users.columnTexts('Company')).toContain('-');

    for (const company of ['BCP', 'BCPG', 'BBGI']) {
      await test.step(company, async () => {
        await users.companyFilter.select(company);
        await expect(users.rows.first()).toBeVisible();
        await users.companyFilter.clearButton.click();
      });
    }
  });

  todo('ผู้ใช้หลาย Company แสดง 2 บริษัทและ badge "+n" (รอ test user ที่มี 3 บริษัทขึ้นไป)');
  todo('บันทึก Access log เมื่อเข้าหน้า (รอ ActivityLogPage, dev ยังไม่ยืนยัน Access log)');
});

test.describe('TS01-TC02 ตรวจสอบการเรียงลำดับ default ของรายการผู้ใช้งาน', () => {
  test('เรียง Unassigned → Pending → Approved', async ({ userManagementPage: users }) => {
    await expect(users.rows.first()).toBeVisible();

    const ranks = (await users.columnTexts('Status')).map((status) => STATUS_ORDER.indexOf(status));

    expect(ranks).not.toContain(-1);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  todo('ตัวกรองช่วงวันที่ default เป็นปีปัจจุบัน (Expected ใน sheet ยังเป็น xxx รอยืนยัน)');
});

test.describe('TS01-TC03 การค้นหาและกรองผู้ใช้งาน', () => {
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

  test('กรอง Status = Pending แสดงเฉพาะ Pending', async ({ userManagementPage: users }) => {
    await users.statusFilter.select('Pending');

    await expect.poll(async () => new Set(await users.columnTexts('Status'))).toEqual(new Set(['Pending']));
  });

  test('ตัวกรอง Role มีครบ 4 Role และกรอง Uploader ได้', async ({ page, userManagementPage: users }) => {
    await users.roleFilter.trigger.click();
    await expect(users.roleFilter.options).toHaveText([...ROLE_NAMES]);
    await page.keyboard.press('Escape');

    await users.roleFilter.select('Uploader');

    await expect.poll(async () => new Set(await users.columnTexts('Role'))).toEqual(new Set(['Uploader']));
  });

  test('กรอง Company = BCPG แสดงผู้ใช้ที่มี BCPG รวมผู้ใช้หลายบริษัท', async ({ userManagementPage: users }) => {
    await users.companyFilter.select('BCPG');

    // A user with more than 2 companies shows "+n", so BCPG may be hidden in the badge; only those that show all are checked
    await expect
      .poll(async () =>
        (await users.columnTexts('Company')).filter((c) => !/\+\d+/.test(c)).every((c) => c.includes('BCPG')),
      )
      .toBe(true);
  });

  test('ค้นหาและกรองพร้อมกัน แสดงผลตามทุกเงื่อนไข', async ({ userManagementPage: users }) => {
    const { email } = credentialsFor('super-user');

    await users.search(email);
    await users.statusFilter.select('Approved');
    await users.roleFilter.select('Super User');

    await expect(users.row(email)).toBeVisible();
    await users.statusFilter.clearButton.click();
    await users.statusFilter.select('Pending');
    await expect(users.emptyState.title).toBeVisible();
  });

  test('ค้นหาคำที่ไม่มีในระบบ แสดง Search not found', async ({ userManagementPage: users }) => {
    await users.search(uniqueName('NotFound'));

    await expect(users.emptyState.title).toBeVisible();
    await expect(users.emptyState.message).toBeVisible();
    await expect(users.rows).toHaveCount(0);
  });

  test('เลือกหลายตัวเลือก แสดงคั่นด้วย comma และผลตรงทุกตัวเลือก', async ({ userManagementPage: users }) => {
    await users.roleFilter.select('System Admin', 'Super User');

    await expect(users.roleFilter.trigger).toContainText('System Admin, Super User');
    await expect
      .poll(async () =>
        (await users.columnTexts('Role')).every((r) => ['System Admin', 'Super User'].includes(r)),
      )
      .toBe(true);
  });

  test('เลือกเกิน 4 ตัวเลือก แสดง badge "+n"', async ({ page, userManagementPage: users }) => {
    // Status has only 3 options and Role 4, so Company is the one filter that can go past 4;
    // the AUTO companies left by the Company Management tests make sure there are more than 4
    await users.companyFilter.trigger.click();
    const companies = (await users.companyFilter.options.allTextContents()).slice(0, 5);
    await page.keyboard.press('Escape');

    await users.companyFilter.select(...companies);

    await expect(users.companyFilter.trigger).toContainText('+1');
  });

  test('กดกากบาท ล้างตัวเลือกทั้งหมดกลับเป็นค่าเริ่มต้น', async ({ userManagementPage: users }) => {
    await users.roleFilter.select('System Admin', 'Super User');

    await users.roleFilter.clearButton.click();

    await expect(users.roleFilter.trigger).toContainText('All Roles');
    await expect.poll(async () => new Set(await users.columnTexts('Role')).size).toBeGreaterThan(2);
  });

  todo('บันทึก Search log พร้อมคำค้น ตัวกรอง และจำนวนผลลัพธ์ (รอ ActivityLogPage)');
});

test.describe('TS01-TC04 ตรวจสอบ Sorting และ Pagination รายการผู้ใช้งาน', () => {
  // Company holds "+n" badges and Created Date needs its format; both are compared once seen on the real page
  const TEXT_COLUMNS: Column[] = ['Email', 'Name', 'Role', 'Status', 'Activation'];

  for (const column of TEXT_COLUMNS) {
    test(`เรียงตาม ${column} ได้ทั้ง 2 ทิศทาง`, async ({ userManagementPage: users }) => {
      await users.columnHeader(column).click();
      await expect.poll(async () => isSorted(await users.columnTexts(column), 'asc')).toBe(true);

      await users.columnHeader(column).click();
      await expect.poll(async () => isSorted(await users.columnTexts(column), 'desc')).toBe(true);
    });
  }

  todo('เรียงตาม Company และ Created Date (รอดูรูปแบบข้อมูลบนหน้าจริง)');

  test('เปลี่ยน Rows per page และเปลี่ยนหน้าได้ถูกต้อง โดยตัวกรองยังอยู่', async ({ userManagementPage: users }) => {
    const { pagination } = users;
    await users.statusFilter.select('Approved');

    // Verify on the real page: which Rows per page options exist (sheet says XX)
    await pagination.setRowsPerPage(10);
    await expect(users.rows).toHaveCount(10);
    await expect(pagination.range).toHaveText(/^1-10 of \d+$/);
    const total = await pagination.total();

    await test.step('หน้าถัดไป / ก่อนหน้า', async () => {
      await pagination.nextPage.click();
      await expect(pagination.range).toHaveText(new RegExp(`^11-${Math.min(20, total)} of ${total}$`));
      await pagination.previousPage.click();
      await expect(pagination.range).toHaveText(`1-10 of ${total}`);
    });

    await test.step('หน้าสุดท้าย / หน้าแรก', async () => {
      await pagination.lastPage.click();
      await expect(pagination.range).toHaveText(new RegExp(`^\\d+-${total} of ${total}$`));
      await pagination.firstPage.click();
      await expect(pagination.range).toHaveText(`1-10 of ${total}`);
    });

    await expect.poll(async () => new Set(await users.columnTexts('Status'))).toEqual(new Set(['Approved']));
  });
});
