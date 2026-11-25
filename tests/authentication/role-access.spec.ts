import { test, expect, todo } from '@fixtures';
import type { Role } from '@config/auth';
import { AccessDeniedComponent } from '@pages/components/access-denied.component';
import { SidebarComponent } from '@pages/components/sidebar.component';

test.fixme(true, 'Draft: no UAT URL/account yet, locators not verified on the real page');

// Menu names as in the Figma sidebar ("Datasource Management", "Report&Section"); the sheet's site map words them differently
const ALL_MENUS = [
  'User Management',
  'Company Management',
  'Datasource Management',
  'Report&Section',
  'Dictionary&Formulas',
  'Activity Log',
  'Prompt Monitoring',
  'Workspace',
];

/** Home page (its title) and sidebar of each role, from the sheet's TS02-TC01 */
const HOMES: { role: Role; label: string; home: string; menus: string[] }[] = [
  {
    role: 'system-admin',
    label: 'System Admin',
    home: 'User Management',
    menus: [
      'User Management',
      'Company Management',
      'Datasource Management',
      'Report&Section',
      'Dictionary&Formulas',
      'Activity Log',
      'Prompt Monitoring',
    ],
  },
  {
    role: 'super-user',
    label: 'Super user',
    home: 'Workspace',
    menus: [
      'User Management',
      'Activity Log',
      'Report&Section',
      'Datasource Management',
      'Dictionary&Formulas',
      'Workspace',
    ],
  },
  {
    role: 'end-user',
    label: 'End user',
    home: 'Workspace',
    menus: ['Report&Section', 'Datasource Management', 'Dictionary&Formulas', 'Workspace'],
  },
  { role: 'uploader', label: 'Uploader', home: 'Datasource Management', menus: ['Datasource Management'] },
];

test.describe('TS02-TC01 ระบบพาไปหน้า Home ตาม Role หลังเข้าสู่ระบบสำเร็จ', () => {
  for (const { role, label, home, menus } of HOMES) {
    test.describe(label, () => {
      test.use({ role });

      test(`เปิดระบบแล้วเห็นหน้า ${home} และเมนูของ ${label}`, { tag: '@smoke' }, async ({ page }) => {
        const sidebar = new SidebarComponent(page);

        await page.goto('/');

        await expect(page.getByRole('heading', { name: home, level: 1 })).toBeVisible();
        for (const menu of menus) await expect(sidebar.menu(menu)).toBeVisible();
        for (const menu of ALL_MENUS.filter((m) => !menus.includes(m)))
          await expect(sidebar.menu(menu)).toBeHidden();
      });
    });
  }
});

/** Pages a role may not open, and the button the Access denied page offers back to its home */
const DENIED: { role: Role; label: string; paths: string[]; back: string; home: string }[] = [
  {
    role: 'end-user',
    label: 'End user',
    paths: ['/company-management'],
    back: 'Back to Workspace',
    home: 'Workspace',
  },
  {
    role: 'uploader',
    label: 'Uploader',
    paths: ['/user-management', '/activity-log'],
    back: 'Back to Data source',
    home: 'Datasource Management',
  },
  {
    role: 'super-user',
    label: 'Super user',
    paths: ['/company-management'],
    back: 'Back to Workspace',
    home: 'Workspace',
  },
];

test.describe('TS02-TC02 ตรวจสอบการเข้าหน้าที่ไม่มีสิทธิ์ผ่าน URL / API โดยตรง', () => {
  for (const { role, label, paths, back, home } of DENIED) {
    test.describe(label, () => {
      test.use({ role });

      for (const path of paths) {
        test(`เปิด ${path} โดยตรง เห็น Access denied และกลับหน้าหลักได้`, async ({ page }) => {
          const denied = new AccessDeniedComponent(page);

          await page.goto(path);

          await expect(denied.title).toBeVisible();
          await denied.backButton(back).click();
          await expect(page.getByRole('heading', { name: home, level: 1 })).toBeVisible();
        });
      }
    });
  }

  todo('System Admin เปิดหน้าที่ไม่มีสิทธิ์ (sheet ยังไม่ระบุหน้า "???")');
});
