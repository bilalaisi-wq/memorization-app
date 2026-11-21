// Explicit advanced navigation; the public landing is now the playable-card grid.
export async function advancedRevision(page){
 await page.locator('#nav-revision-lab').click();
 await page.locator('.revision-game-grid,.cosmic-form,.revision-missions,[data-context-cosmic]').first().waitFor({state:'visible'});
 if(await page.locator('[data-cosmic-select]').isVisible())await page.locator('[data-cosmic-select]').click();
}

export async function revisionMissions(page){
 await page.locator('.revision-game-grid,.cosmic-form,.revision-missions').first().waitFor({state:'visible'});
 if(await page.locator('.revision-missions').isVisible())return;
 await page.locator('[data-revision-missions],[data-revision-game=marathon]').first().click();
}
