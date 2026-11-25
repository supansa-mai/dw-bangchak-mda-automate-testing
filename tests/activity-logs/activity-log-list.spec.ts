import { test, expect, todo } from '@fixtures';
import { credentialsFor } from '@config/auth';
import { expectLogged, expectNewLog } from '@helpers/activity-log';
import { bangkokDmy, bangkokYear } from '@helpers/date';
import { randomLetters } from '@helpers/test-data';
import { ACTIVITIES, LOG_COLUMNS, type LogQuery } from '@pages/activity-log.page';

test.fixme(true, 'Draft: no UAT URL/account yet, locators not verified on the real page');

// Every visit writes an Access log of the Activity Log page, so it is the one kind of log a test can count on
const OWN_ACCESS = { activity: 'Access', object: 'Activity Log' } satisfies LogQuery;

/** From the 1st of this month to today: today's logs are in it, and both days are in the months the picker opens on */
function thisMonthSoFar() {
  const today = new Date();
  return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
}

test.beforeEach(async ({ activityLogPage: logs }) => {
  await logs.goto();
});

test.describe('TS01-TC01 System Admin สามารถเห็นหน้า Activity Log', () => {
  test(
    'เปิดจากเมนู Sidebar แล้วเห็นหน้า Activity Log ครบ และยังไม่แสดง log',
    { tag: '@smoke' },
    async ({ page, activityLogPage: logs }) => {
      await page.goto('/');
      await logs.sidebar.open('Activity Log');

      await expect(logs.heading).toBeVisible();
      await expect(logs.exportButton).toBeDisabled();
      await expect(logs.yearSelect).toBeVisible();
      await expect(logs.dateRangePicker).toBeDisabled();
      await expect(logs.searchTypeSelect).toHaveText('Name');
      await expect(logs.searchInput).toHaveAttribute('placeholder', 'Search by Name');
      await expect(logs.companyFilter.trigger).toBeVisible();
      await expect(logs.activityFilter.trigger).toBeVisible();
      await expect(logs.objectFilter.trigger).toBeDisabled();
      for (const column of LOG_COLUMNS) await expect(logs.columnHeader(column)).toBeVisible();
      await expect(logs.startState.title).toBeVisible();
      await expect(logs.startState.message).toBeVisible();
      await expect(logs.rows).toHaveCount(0);
    },
  );

  test('ตัวกรอง Company มีทุกบริษัท และเห็น log ของผู้ใช้คนอื่น', async ({ page, activityLogPage: logs }) => {
    await logs.companyFilter.trigger.click();
    for (const company of ['BCP', 'BCPG', 'BBGI'])
      await expect(logs.companyFilter.option(company)).toBeVisible();
    await page.keyboard.press('Escape');

    await logs.query({ ...OWN_ACCESS, email: credentialsFor('super-user').email });

    await expect(logs.rows.first()).toBeVisible();
  });

  test('บันทึก Access log เมื่อเข้าหน้า', async ({ activityLogPage: logs }) => {
    const query = { ...OWN_ACCESS, email: credentialsFor('system-admin').email } satisfies LogQuery;
    const before = await logs.count(query);

    await logs.goto();

    const log = await expectNewLog(logs, query, before, 'accessed Activity Log');
    await expect(logs.cell(log, 'Activity')).toHaveText('Access');
    await expect(logs.cell(log, 'Object')).toHaveText('Activity Log');
  });
});

test.describe('TS01-TC02 Super user เห็นเฉพาะ Activity Log ของบริษัทตัวเอง', () => {
  // The seeded Super user belongs to BCP only
  test.use({ role: 'super-user' });

  test('ตัวกรอง Company มีแค่ BCP และทุก log เป็นของ BCP', async ({ page, activityLogPage: logs }) => {
    await logs.companyFilter.trigger.click();
    await expect(logs.companyFilter.options).toHaveText(['BCP']);
    await page.keyboard.press('Escape');

    await logs.query({ activity: 'Access' });

    await expect(logs.rows.first()).toBeVisible();
    // A user with more than 2 companies shows "+n", so BCP may be hidden in the badge; only those that show all are checked
    const companies = (await logs.columnTexts('Company')).filter((c) => !/\+\d+/.test(c));
    expect(companies.every((c) => c.includes('BCP'))).toBe(true);
  });

  todo('Super user ที่สังกัด BCP และ BCPG เห็น activity ของทั้ง 2 บริษัท (รอบัญชี Super user BCPG ใน .env)');
});

test.describe('TS01-TC03 การค้นหาและกรอง Activity Log', () => {
  test('Dropdown ปีมีเฉพาะปีที่มีข้อมูล และ Date picker ใช้ได้หลังเลือกปี', async ({ activityLogPage: logs }) => {
    const year = bangkokYear();
    await expect(logs.dateRangePicker).toBeDisabled();

    await logs.yearSelect.click();
    // This year always has logs (every visit writes one); next year can't have any yet
    await expect(logs.option(String(Number(year) + 1))).toBeHidden();
    await logs.option(year).click();

    await expect(logs.dateRangePicker).toBeEnabled();
  });

  test('ปฏิทินเลื่อนไปได้ไม่เกินเดือนธันวาคมของปีที่เลือก', async ({ activityLogPage: logs }) => {
    const year = bangkokYear();
    await logs.selectYear(year);
    await logs.dateRangePicker.click();

    await logs.showLastMonthOfYear();

    await expect(logs.nextMonthButton).toBeDisabled();
    await expect(logs.month(new Date(Number(year), 11, 1))).toBeVisible();
  });

  todo('เลือกวันสิ้นสุดก่อนวันเริ่มต้นไม่ได้ (Figma ไม่ได้แสดงว่าระบบทำอย่างไรเมื่อกดวันก่อนวันเริ่มต้น)');

  test('ค้นหาด้วย Email แสดงเฉพาะ log ของอีเมลที่ตรง', async ({ activityLogPage: logs }) => {
    const { email } = credentialsFor('system-admin');
    const keyword = email.split('@')[0].slice(0, 5);

    await logs.searchBy('Email', keyword);

    await expect(logs.searchInput).toHaveAttribute('placeholder', 'Search by Email');
    await expect(logs.rows.first()).toBeVisible();
    expect(
      (await logs.columnTexts('Email')).every((e) => e.toLowerCase().includes(keyword.toLowerCase())),
    ).toBe(true);
  });

  test('ค้นหาด้วย Name แสดงเฉพาะ log ของชื่อที่ตรง', async ({ activityLogPage: logs }) => {
    // Names of the accounts aren't in .env, so take the admin's from its own log
    await logs.query({ ...OWN_ACCESS, email: credentialsFor('system-admin').email });
    const [keyword] = (await logs.cell(logs.rows.first(), 'Name').innerText()).split(' ');
    await logs.goto();

    await logs.searchBy('Name', keyword);

    await expect(logs.rows.first()).toBeVisible();
    expect(
      (await logs.columnTexts('Name')).every((n) => n.toLowerCase().includes(keyword.toLowerCase())),
    ).toBe(true);
  });

  // Sheet uses BBGI, which may have no activity on UAT; BCP always has the seeded Super user's
  test('กรอง Company = BCP แสดงเฉพาะ log ของ BCP', async ({ activityLogPage: logs }) => {
    await logs.query({ company: 'BCP' });

    await expect(logs.rows.first()).toBeVisible();
    const companies = (await logs.columnTexts('Company')).filter((c) => !/\+\d+/.test(c));
    expect(companies.every((c) => c.includes('BCP'))).toBe(true);
  });

  test('ตัวกรอง Activity มีครบ 13 ประเภท', async ({ page, activityLogPage: logs }) => {
    await logs.activityFilter.trigger.click();

    await expect(page.getByRole('option')).toHaveText([...ACTIVITIES]);
  });

  test('Activity เลือกได้ทีละ 1 ประเภท แสดงเฉพาะประเภทที่เลือก', async ({ activityLogPage: logs }) => {
    await logs.activityFilter.select('Search');

    await logs.activityFilter.select('Access');

    await expect(logs.rows.first()).toBeVisible();
    expect(new Set(await logs.columnTexts('Activity'))).toEqual(new Set(['Access']));
  });

  test('Select Object ใช้ได้เมื่อเลือก Activity ที่มี Object เท่านั้น', async ({ activityLogPage: logs }) => {
    await expect(logs.objectFilter.trigger).toBeDisabled();

    await logs.activityFilter.select('Login');
    await expect(logs.objectFilter.trigger).toBeDisabled();

    await logs.activityFilter.select('Create');
    await expect(logs.objectFilter.trigger).toBeEnabled();
  });

  // Sheet uses Edit + User; Access + Activity Log is the pair that always has data
  test('เลือก Activity และ Object แสดงเฉพาะที่เลือก', async ({ activityLogPage: logs }) => {
    await logs.query(OWN_ACCESS);

    await expect(logs.rows.first()).toBeVisible();
    expect(new Set(await logs.columnTexts('Activity'))).toEqual(new Set(['Access']));
    expect(new Set(await logs.columnTexts('Object'))).toEqual(new Set(['Activity Log']));
  });

  test('ค้นหาและกรองพร้อมกัน แสดงผลตามทุกเงื่อนไข', async ({ activityLogPage: logs }) => {
    const { email } = credentialsFor('system-admin');

    await logs.query({ ...OWN_ACCESS, email });

    await expect(logs.rows.first()).toBeVisible();
    expect(new Set(await logs.columnTexts('Email'))).toEqual(new Set([email]));
    expect(new Set(await logs.columnTexts('Activity'))).toEqual(new Set(['Access']));
  });

  test('ค้นหาคำที่ไม่มี แสดง No matching activity และบันทึก Search log', async ({ activityLogPage: logs }) => {
    const keyword = `auto.${randomLetters(8).toLowerCase()}`;

    await logs.searchBy('Email', keyword);

    await expect(logs.noMatch).toBeVisible();
    await expect(logs.rows).toHaveCount(0);

    await test.step('Search log มีคำค้นและจำนวนผลลัพธ์', async () => {
      const query = {
        email: credentialsFor('system-admin').email,
        activity: 'Search',
        object: 'Activity Log',
      } satisfies LogQuery;
      const log = await expectLogged(logs, query, `"${keyword}"`);
      await expect(log).toContainText('found 0 result(s)');
    });
  });

  test('เลือกช่วงวันที่ แสดงเฉพาะ log ในช่วงนั้น และช่องแสดงช่วงวันที่', async ({ activityLogPage: logs }) => {
    const { from, to } = thisMonthSoFar();
    await logs.selectYear(bangkokYear());

    await logs.selectDateRange(from, to);

    await expect(logs.dateRangePicker).toHaveValue(`${bangkokDmy(from)} - ${bangkokDmy(to)}`);
    await expect(logs.rows.first()).toBeVisible();
    // Verify on the real page: the Date column starts with DD/MM/YYYY
    const monthAndYear = bangkokDmy(to).slice(3);
    expect((await logs.columnTexts('Date')).every((date) => date.includes(monthAndYear))).toBe(true);
  });

  todo('เปลี่ยนปีแล้วล้างช่วงวันที่และข้อมูล (รอข้อมูลปีอื่นบน UAT: dropdown มีเฉพาะปีที่มีข้อมูล)');
});
