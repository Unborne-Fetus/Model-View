/** Printer build-envelope presets. These are geometry checks, NOT device drivers or G-code presets.
 * Verify printer bed dimensions and installed nozzle against the real machine.
 * Sources checked 2026-11:
 * - Creality Ender-3 V3 SE: https://www.creality.com/compare/compare-ender-3-v3-series
 * - Bambu Lab A1: https://store.bblcdn.com/8137fad1525a4454ac8a28502edbc919.pdf
 * - Original Prusa MK4S: https://cdn.prusa3d.com/product/original-prusa-mk4s-3d-printer-5/
 */
export const PRINTERS = Object.freeze([
  {id:'generic',name:'Generic FDM printer (220 × 220 × 250)',volume:[220,220,250],nozzle:0.4,filament:1.75,
    layer:[0.1,0.3],slicer:'Choose a slicer with a matching printer profile'},
  {id:'ender3-v3-se',name:'Creality Ender-3 V3 SE',volume:[220,220,250],nozzle:0.4,filament:1.75,
    layer:[0.1,0.35],slicer:'Creality Print or Cura with the correct Ender-3 V3 SE profile'},
  {id:'bambu-a1',name:'Bambu Lab A1',volume:[256,256,256],nozzle:0.4,filament:1.75,
    layer:[0.08,0.32],slicer:'Bambu Studio with the matching A1 printer profile'},
  {id:'prusa-mk4s',name:'Original Prusa MK4S',volume:[250,210,220],nozzle:0.4,filament:1.75,
    layer:[0.05,0.30],slicer:'PrusaSlicer with the matching MK4S printer profile'},
  {id:'custom',name:'Custom FDM printer',volume:[220,220,250],nozzle:0.4,filament:1.75,
    layer:[0.05,0.4],slicer:'Use the manufacturer-recommended printer slicer'}
]);
export function printerById(id){return PRINTERS.find(x=>x.id===id)||PRINTERS[0]}

/** Only checks geometric fit and settings plausibility.
 * The result does NOT certify printable material, bed geometry, firmware or toolpaths.
 */
export function validatePrintFit({dimensions,volume,nozzle,layerHeight,margin=0,filament=1.75,supports=[]}) {
  if(!Array.isArray(dimensions)||dimensions.length!==3||dimensions.some(n=>!Number.isFinite(n)||n<0))
    throw new Error('A finite three-axis model size is required.');
  if(!Array.isArray(volume)||volume.length!==3||volume.some(n=>!Number.isFinite(n)||n<1||n>10000))
    throw new Error('Printer build volume must have positive dimensions in millimetres.');
  if(!Number.isFinite(margin)||margin<0||margin>100)
    throw new Error('Build-plate margin must be between 0 and 100 mm.');
  if(!Number.isFinite(nozzle)||nozzle<0.1||nozzle>2)
    throw new Error('Nozzle diameter must be between 0.1 and 2 mm.');
  if(!Number.isFinite(layerHeight)||layerHeight<=0||layerHeight>2)
    throw new Error('Choose a valid layer height.');
  if(!Number.isFinite(filament)||filament<1||filament>3.5)
    throw new Error('Verify the filament diameter.');
  const usable=[Math.max(0,volume[0]-2*margin),Math.max(0,volume[1]-2*margin),volume[2]];
  const fits=dimensions.every((length,axis)=>length<=usable[axis]+1e-6);
  const problems=[],warnings=[];
  for(let i=0;i<3;i++)if(dimensions[i]>usable[i]+1e-6)
    problems.push('Model '+['X','Y','Z'][i]+' dimension '+dimensions[i].toFixed(1)+
      ' mm exceeds usable printer '+['X','Y','Z'][i]+' dimension '+usable[i].toFixed(1)+' mm.');
  if(layerHeight>nozzle*0.8)
    warnings.push('Layer height exceeds 80% of nozzle diameter; use a smaller layer height or verify your printer settings.');
  if(layerHeight<nozzle*0.1)
    warnings.push('Layer height is below 10% of nozzle diameter; verify achievable printer resolution.');
  if(supports.length) {
    const outside=supports.some(s=>s.x-s.radius<margin||s.y-s.radius<margin||
      s.x+s.radius>volume[0]-margin||s.y+s.radius>volume[1]-margin||s.to>volume[2]);
    if(outside)problems.push('One or more support columns extend outside the usable build area.');
  }
  return {fits:fits&&!problems.length,usable,problems,warnings,
    modelSize:dimensions.map(x=>Number(x.toFixed(3))),
    bedSize:volume.slice(),margin,nozzle,layerHeight,filament};
}

export function exportPrintSetup({printer,volume,nozzle,filament,layerHeight,margin,dimensions,checks,supportsCount=0}) {
  return JSON.stringify({app:'Model View',kind:'print-preflight-report',schemaVersion:1,
    note:'Reference data only: not a native slicer or printer configuration and not machine instructions.',
    printerId:printer.id,printerName:printer.name,recommendedSlicer:printer.slicer,
    dimensionsMm:dimensions,buildVolumeMm:volume,buildPlateMarginMm:margin,
    nozzleMm:nozzle,filamentDiameterMm:filament,layerHeightMm:layerHeight,
    supportsCount,fit:checks},null,2);
}
