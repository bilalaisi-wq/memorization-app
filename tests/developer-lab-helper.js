// Explicit developer presentation fixture, not a storage flag or backend authorization.
export async function enableDeveloperLab(page) {
  await page.locator('#site-menu-toggle').waitFor();
  await page.evaluate(async()=>{
    const access=await import('/src/developer/access.js');
    access.setDeveloperUser({id:'test-owner',email:'bilalaisi@gmail.com',email_confirmed_at:'2026-01-01'});
    access.setDeveloperPreview(true);
  });
}
