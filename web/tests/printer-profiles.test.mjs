import test from 'node:test';
import assert from 'node:assert/strict';
import {PRINTERS,printerById,validatePrintFit,exportPrintSetup} from '../src/printer-profiles.js';

test('supported printers have distinct bed envelopes and configurable nozzles',()=>{
  assert.equal(PRINTERS.length,5);
  assert.deepEqual(printerById('bambu-a1').volume,[256,256,256]);
  assert.deepEqual(printerById('prusa-mk4s').volume,[250,210,220]);
  assert.deepEqual(printerById('ender3-v3-se').volume,[220,220,250]);
  assert.deepEqual(printerById('unknown').volume,[220,220,250]);
});
test('validates fit including a bed margin and height',()=>{
  const options={dimensions:[210,200,110],volume:[220,220,250],nozzle:0.4,layerHeight:0.2};
  assert.equal(validatePrintFit(options).fits,true);
  const narrow=validatePrintFit({...options,margin:10});
  assert.equal(narrow.fits,false);
  assert.ok(narrow.problems.some(x=>x.includes('X dimension')));
  assert.equal(validatePrintFit({...options,dimensions:[100,100,270]}).fits,false);
});
test('support columns outside the printable bed are blocked',()=>{
  const base={dimensions:[100,100,80],volume:[220,220,250],nozzle:0.4,layerHeight:0.2,margin:0};
  const bad=validatePrintFit({...base,supports:[{x:0,y:10,radius:1,from:0,to:12}]});
  assert.equal(bad.fits,false);
  assert.match(bad.problems.join(' '),/support columns/);
});
test('warn about extreme nozzle versus layer height and invalid inputs',()=>{
  const base={dimensions:[50,50,50],volume:[220,220,250],nozzle:0.4};
  assert.equal(validatePrintFit({...base,layerHeight:0.4}).warnings.length,1);
  assert.throws(()=>validatePrintFit({...base,layerHeight:0.2,volume:[0,220,250]}),/build volume/);
  assert.throws(()=>validatePrintFit({...base,layerHeight:0.2,margin:-1}),/margin/);
});
test('JSON export states it is not a printer machine profile',()=>{
  const printer=printerById('bambu-a1');
  const checks=validatePrintFit({dimensions:[10,10,10],volume:printer.volume,nozzle:0.4,layerHeight:0.2});
  const data=JSON.parse(exportPrintSetup({printer,volume:printer.volume,nozzle:0.4,filament:1.75,
    layerHeight:0.2,margin:0,dimensions:[10,10,10],checks}));
  assert.equal(data.printerId,'bambu-a1');
  assert.equal(data.fit.fits,true);
  assert.match(data.note,/not a native slicer or printer configuration/);
});
