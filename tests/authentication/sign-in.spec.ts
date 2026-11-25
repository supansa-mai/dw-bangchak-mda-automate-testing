import { test, expect } from '@fixtures';

test.use({ role: null });

test.describe('TS01-TC01 ผู้ใช้งานสามารถเห็นหน้า Sign in', () => {
  test('แสดงหน้า Sign in ที่มีแค่ปุ่ม Sign in with Microsoft', { tag: '@smoke' }, async ({ page, signInPage }) => {
    await signInPage.goto();

    await expect(signInPage.logo).toBeVisible();
    await expect(signInPage.title).toBeVisible();
    await expect(signInPage.signInWithMicrosoftButton).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
  });

  test('เปิดหน้าอื่นโดยตรงโดยไม่มี session ถูกพากลับหน้า Sign in', async ({ page, signInPage }) => {
    await page.goto('/user-management');

    await expect(signInPage.signInWithMicrosoftButton).toBeVisible();
    await expect(page).not.toHaveURL(/user-management/);
  });
});

test.describe('TS01-TC02 การเข้าสู่ระบบสำเร็จ - ผู้ใช้งานมี Role, Company และสถานะ Approved + Active', () => {
  // Signing in itself goes through Microsoft MFA (auth.setup.ts / npm run auth:manual); here only the parts around it
  test('กด Sign in with Microsoft แล้วไปหน้า Sign in ของ Microsoft', async ({ page, signInPage }) => {
    await signInPage.goto();

    await signInPage.startMicrosoftSignIn();

    await expect(page).toHaveURL(/login\.microsoftonline\.com/);
  });

  test.describe('มี session ที่ยังไม่หมดอายุ', () => {
    test.use({ role: 'end-user' });

    test('เปิดระบบแล้วไปหน้า Home ตาม Role ทันที', async ({ page, signInPage }) => {
      await signInPage.goto();

      await expect(page.getByRole('heading', { name: 'Workspace', level: 1 })).toBeVisible();
      await expect(signInPage.signInWithMicrosoftButton).toBeHidden();
    });
  });
});
