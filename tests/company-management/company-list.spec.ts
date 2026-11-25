import { test, expect, todo } from '@fixtures';
import { AUTO_PREFIX, uniqueName } from '@helpers/test-data';
import { isSorted } from '@helpers/table';

test.fixme(true, 'Draft: no UAT URL/account yet, locators not verified on the real page');

const SEED_COMPANIES = ['BCP', 'BCPG', 'BBGI'];

test.describe('TS01-TC01 System Admin สามารถเห็นหน้า Company Management', () => {
  test(
    'เปิดจากเมนู Sidebar แล้วเห็นหน้า Company Management ครบ',
    { tag: '@smoke' },
    async ({ page, companyManagementPage: companies }) => {
      await page.goto('/');
      await companies.sidebar.open('Company Management');

      await expect(page).toHaveURL(/company-management/);
      await expect(companies.heading).toBeVisible();
      await expect(companies.addNewCompanyButton).toBeVisible();
      await expect(companies.searchInput).toBeVisible();
      await expect(companies.columnHeader('Company Name')).toBeVisible();
      await expect(companies.columnHeader('Main Company')).toBeVisible();
      await expect(companies.editButtonOf('BCP')).toBeVisible();
      await expect(companies.pagination.rowsPerPage).toContainText('20');
    },
  );

  test('แสดงบริษัทตั้งต้น BCP, BCPG, BBGI', async ({ companyManagementPage: companies }) => {
    await companies.goto();

    for (const name of SEED_COMPANIES) {
      await companies.search(name);
      await expect(companies.row(name)).toBeVisible();
    }
  });

  todo('บันทึก Access log เมื่อเข้าหน้า (รอ ActivityLogPage, dev ยังไม่ยืนยัน Access log)');
});

test.describe('TS01-TC02 การค้นหารายการบริษัท', () => {
  test.beforeEach(async ({ companyManagementPage: companies }) => {
    await companies.goto();
  });

  test('ค้นหา "BCP" แสดงเฉพาะบริษัทที่ชื่อมี BCP', async ({ companyManagementPage: companies }) => {
    await companies.search('BCP');

    await expect(companies.row('BCP')).toBeVisible();
    await expect(companies.row('BCPG')).toBeVisible();
    await expect(companies.row('BBGI')).toBeHidden();
    expect((await companies.columnTexts(0)).every((name) => /bcp/i.test(name))).toBe(true);
  });

  test('ค้นหาตัวพิมพ์เล็ก "bcp" ได้ผลเหมือน "BCP"', async ({ companyManagementPage: companies }) => {
    await companies.search('BCP');
    await expect(companies.row('BCPG')).toBeVisible();
    const upperCaseResult = await companies.columnTexts(0);

    await companies.search('bcp');

    await expect.poll(() => companies.columnTexts(0)).toEqual(upperCaseResult);
  });

  test('ค้นหาคำที่ไม่มีในระบบ แสดง Search not found', async ({ companyManagementPage: companies }) => {
    await companies.search(uniqueName('NotFound'));

    await expect(companies.emptyState.title).toBeVisible();
    await expect(companies.emptyState.message).toBeVisible();
    await expect(companies.emptyState.resetFiltersButton).toBeVisible();
    await expect(companies.rows).toHaveCount(0);
  });

  test('ลบคำค้นหาออก แสดงรายการทั้งหมดอีกครั้ง', async ({ companyManagementPage: companies }) => {
    await companies.search(uniqueName('NotFound'));
    await expect(companies.emptyState.title).toBeVisible();

    await companies.searchInput.clear();

    await expect(companies.emptyState.title).toBeHidden();
    await expect(companies.rows.first()).toBeVisible();
  });

  todo('บันทึก Search log พร้อมคำค้นและจำนวนผลลัพธ์ (รอ ActivityLogPage)');
});

test.describe('TS01-TC03 ตรวจสอบการ Sorting และ Pagination รายการบริษัท', () => {
  test.beforeEach(async ({ companyManagementPage: companies }) => {
    await companies.goto();
  });

  test('เรียงตาม Company Name ได้ทั้ง A→Z และ Z→A', async ({ companyManagementPage: companies }) => {
    await companies.columnHeader('Company Name').click();
    await expect.poll(async () => isSorted(await companies.columnTexts(0), 'asc')).toBe(true);

    await companies.columnHeader('Company Name').click();
    await expect.poll(async () => isSorted(await companies.columnTexts(0), 'desc')).toBe(true);
  });

  test('เรียงตาม Main Company ได้ทั้ง 2 ทิศทาง', async ({ companyManagementPage: companies }) => {
    // "-" (no Main Company) may sort first or last; only the named ones are checked
    const mainCompanies = async () => (await companies.columnTexts(1)).filter((name) => name !== '-');

    await companies.columnHeader('Main Company').click();
    await expect.poll(async () => isSorted(await mainCompanies(), 'asc')).toBe(true);

    await companies.columnHeader('Main Company').click();
    await expect.poll(async () => isSorted(await mainCompanies(), 'desc')).toBe(true);
  });

  test('เปลี่ยน Rows per page และเปลี่ยนหน้าได้ถูกต้อง โดยคำค้นยังอยู่', async ({ companyManagementPage: companies }) => {
    const { pagination } = companies;
    // Needs more than 10 AUTO companies; the tests that add companies leave plenty on UAT
    await companies.search(AUTO_PREFIX);

    // Verify on the real page: which Rows per page options exist (sheet says XX)
    await pagination.setRowsPerPage(10);
    await expect(companies.rows).toHaveCount(10);
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

    await expect(companies.searchInput).toHaveValue(AUTO_PREFIX);
  });
});
