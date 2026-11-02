import {test,expect} from '@playwright/test';

const boxObj=`o SolidCube
v 0 0 0
v 10 0 0
v 10 10 0
v 0 10 0
v 0 0 10
v 10 0 10
v 10 10 10
v 0 10 10
f 1 4 3
f 1 3 2
f 5 6 7
f 5 7 8
f 1 2 6
f 1 6 5
f 4 8 7
f 4 7 3
f 1 5 8
f 1 8 4
f 2 3 7
f 2 7 6
`;

test('edit mesh transforms, undo, and add simple primitives',async ({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:/Try a demo/i}).click();
  await expect(page.locator('#editMesh')).toBeEnabled();
  const starting=await page.locator('#editMesh option').count();
  await page.locator('#editPx').fill('12');
  await page.locator('#applyEdit').click();
  await expect(page.locator('#editPx')).toHaveValue('12');
  await page.locator('#undoEdit').click();
  await expect(page.locator('#editPx')).toHaveValue('0');
  await page.locator('#primitiveType').selectOption('box');
  await page.locator('#addPrimitive').click();
  await expect(page.locator('#editMesh option')).toHaveCount(starting+1);
  await page.locator('#duplicateMesh').click();
  await expect(page.locator('#editMesh option')).toHaveCount(starting+2);
  await page.locator('#deleteMesh').click();
  await expect(page.locator('#editMesh option')).toHaveCount(starting+1);
});

test('slice solid cube into real layers, preview SVG and download STL',async ({page})=>{
  await page.goto('./');
  await page.locator('#filesInput').setInputFiles({name:'cube.obj',mimeType:'text/plain',buffer:Buffer.from(boxObj)});
  await expect(page.locator('#activeName')).toHaveText('cube.obj');
  await expect(page.locator('#sliceModel')).toBeEnabled();
  await page.locator('#layerHeight').fill('1');
  await page.locator('#sliceModel').click();
  await expect(page.locator('#sliceViewer')).toBeVisible();
  await expect(page.locator('#printResult')).toContainText('10 layers');
  await expect(page.locator('#sliceIndex')).toContainText('loops');
  await page.locator('#sliceLayer').evaluate(el => {el.value='4';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect(page.locator('#sliceIndex')).toContainText('5 / 10');
  const svg=page.waitForEvent('download');
  await page.locator('#saveSlice').click();
  expect((await svg).suggestedFilename()).toMatch(/layer-5\.svg$/);
  const stl=page.waitForEvent('download');
  await page.locator('#saveStl').click();
  expect((await stl).suggestedFilename()).toMatch(/-print\.stl$/);
});
