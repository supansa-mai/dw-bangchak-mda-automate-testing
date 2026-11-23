import { test, expect } from '@fixtures';

test.use({ role: null });

test.describe('TS01-TC01 ผู้ใช้งานสามารถเห็นหน้า Sign in', () => {
  test('แสดงหน้า Sign in ที่มีแค่ปุ่ม Sign in with Microsoft @smoke', async ({ page, signInPage }) => {
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
