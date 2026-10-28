export async function startFalling(page) {
  await page.locator("[name=audio]").selectOption("silent");
  await page.getByRole("button", { name: "Start", exact: true }).click();
}
export async function parkExtra(page) {
  const width = () =>
    page.locator(".tetromino-cell.active").evaluateAll((nodes) => {
      const xs = nodes.map((n) => Number(n.style.getPropertyValue("--x")));
      return Math.max(...xs) - Math.min(...xs) + 1;
    });
  if ((await width()) > 3) await page.locator("#fall-rotate").click();
  for (let i = 0; i < 10; i++) await page.locator("#fall-left").click();
  await page.locator("#fall-place").click();
}
