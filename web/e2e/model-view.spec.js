import {test,expect} from '@playwright/test';
import JSZip from 'jszip';

test('Model View is rebranded, opens demo and downloads quality report', async ({page}) => {
  await page.goto('./');
  await expect(page).toHaveTitle(/Model View/);
  await expect(page.getByRole('heading',{name:/Know your 3D models/i})).toBeVisible();
  await page.getByRole('button',{name:/Try a demo/i}).click();
  await expect(page.locator('#healthLabel')).toContainText(/NO ISSUES DETECTED|REVIEW RECOMMENDED/);
  await expect(page.locator('#statMeshes')).not.toHaveText('—');
  await expect(page.locator('#exportGlb')).toBeEnabled();
  const download=page.waitForEvent('download');
  await page.locator('#exportReport').click();
  expect((await download).suggestedFilename()).toMatch(/demo-model-report\.json/);
  await page.locator('#wireToggle').check();
  const glbDownload=page.waitForEvent('download');
  await page.locator('#exportGlb').click();
  expect((await glbDownload).suggestedFilename()).toMatch(/\.glb$/);
});

test('a plain OBJ file is rendered with an audit and exported as GLB', async ({page}) => {
  await page.goto('./');
  await page.locator('#filesInput').setInputFiles({
    name:'sample.obj',mimeType:'text/plain',
    buffer:Buffer.from('o Sample\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')
  });
  await expect(page.locator('#activeName')).toHaveText('sample.obj',{timeout:15000});
  await expect(page.locator('#statTriangles')).toHaveText('1');
  await expect(page.locator('#sourceFormat')).toHaveText('OBJ');
  await expect(page.locator('#exportReport')).toBeEnabled();
});

test('ZIP import finds generic model assets', async ({page}) => {
  const zip=new JSZip();
  zip.file('model/scene.obj','o Model\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
  const bytes=await zip.generateAsync({type:'nodebuffer'});
  await page.goto('./');
  await page.locator('#filesInput').setInputFiles({name:'scene.zip',mimeType:'application/zip',buffer:bytes});
  await expect(page.locator('#activeName')).toHaveText('scene.obj',{timeout:15000});
  await expect(page.locator('#modelCount')).toContainText('1/1');
});


test('ZIP with several OBJ files supports filtering and explicit model selection', async ({page}) => {
  const zip = new JSZip();
  zip.file('props/chair.obj', 'o Chair\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
  zip.file('props/table.obj', 'o Table\nv 0 0 0\nv 2 0 0\nv 0 2 0\nf 1 2 3\n');
  await page.goto('./');
  await page.locator('#filesInput').setInputFiles({
    name: 'props.zip', mimeType: 'application/zip',
    buffer: await zip.generateAsync({type: 'nodebuffer'})
  });
  await expect(page.locator('#modelCount')).toHaveText('2/2');
  await expect(page.locator('#loadModel')).toBeEnabled();
  await page.locator('#modelSearch').fill('table');
  await expect(page.locator('#modelCount')).toHaveText('1/2');
  await page.locator('#loadModel').click();
  await expect(page.locator('#activeName')).toHaveText('table.obj');
  await expect(page.locator('#statTriangles')).toHaveText('1');
});

test('OBJ and companion MTL files import together as one model', async ({page}) => {
  await page.goto('./');
  await page.locator('#filesInput').setInputFiles([
    {name:'textured.obj',mimeType:'text/plain',buffer:Buffer.from(
      'mtllib textured.mtl\no Shape\nv 0 0 0\nv 1 0 0\nv 0 1 0\nusemtl colorA\nf 1 2 3\n')},
    {name:'textured.mtl',mimeType:'text/plain',buffer:Buffer.from(
      'newmtl colorA\nKd 0.2 0.8 0.6\n')}
  ]);
  await expect(page.locator('#activeName')).toHaveText('textured.obj');
  await expect(page.locator('#statTriangles')).toHaveText('1');
  await expect(page.locator('#statMaterials')).not.toHaveText('—');
});

test('corrupt ZIP displays actionable error instead of becoming a blank screen', async ({page}) => {
  await page.goto('./');
  await page.locator('#filesInput').setInputFiles({
    name:'broken.zip',mimeType:'application/zip',buffer:Buffer.from('not a zip')
  });
  await expect(page.locator('#importStatus')).toContainText('Import failed');
  await expect(page.locator('#statusLine')).toHaveClass(/error/);
  await expect(page.locator('#tryDemo')).toBeEnabled();
});

test('reserved ad slots remain inactive and never overlay the viewer', async ({page}) => {
  await page.goto('./');
  await expect(page.locator('[data-ad-slot="leaderboard"]')).toBeVisible();
  await expect(page.locator('[data-ad-slot="below-workspace"]')).toBeVisible();
  await expect(page.locator('[data-ad-slot="leaderboard"]')).toContainText(/Advertising is not active/);
  await expect(page.locator('script[src*="adsbygoogle"]')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('specialized legacy explorer remains available on a separate page', async ({page}) => {
  await page.goto('./legacy.html');
  await expect(page).toHaveTitle(/Model View/);
  await expect(page.locator('#tabArchive')).toBeVisible();
});
