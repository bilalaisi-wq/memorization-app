export async function menu(page) {
  const toggle = page.locator('#site-menu-toggle');
  await toggle.waitFor();
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  return page;
}
