/** Model View editing and print-preview controllers. Does not add printer G-code. */
import * as THREE from 'three';
import {editableMeshes,meshSnapshot,applySnapshot,applyMeshEdit,addPrimitive,duplicateMesh,removeEditableMesh} from './model-editor.js';
import {extractPrintMesh,slicePreview,contoursAt,generateSupports,exportPrintStl,sliceSvg,topologyReport} from './print-tools.js';
import {downloadBlob} from './model.js';
import {printerById,validatePrintFit,exportPrintSetup} from './printer-profiles.js';

const $=id=>document.getElementById(id);
const transformIds=['editPx','editPy','editPz','editRx','editRy','editRz','editSx','editSy','editSz'];
const labels=['px','py','pz','rx','ry','rz','sx','sy','sz'];
const fileName=s=>String(s).replace(/\.[^.]+$/,'').replace(/[^a-z0-9._-]/gi,'_').slice(0,100)||'model';

export function initializeStudio({getRoot,getStage,onChanged,onMessage}) {
  let selection=null,history=[],print=null,helpers=null;
  function meshes(){return editableMeshes(getRoot());}
  function clearHelpers(){
    if(!helpers)return;
    helpers.parent?.remove(helpers);
    helpers.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.()});
    helpers=null;
  }
  function invalidateSlice(){
    print=null;clearHelpers();
    $('sliceViewer').hidden=true;
    $('printResult').textContent='Model changed. Slice again to update the print preview.';
  }
  function changed(){
    // An active clip may overwrite user-edited transforms on the next frame.
    const stage=getStage();
    if(stage?.currentAction)stage.currentAction.paused=true;
    if(stage)stage.playing=false;
    invalidateSlice();
    onChanged();
    stage?.frame();
    refreshMeshList(selection?.uuid);
  }
  function selected(){return meshes().find(x=>x.uuid===selection?.uuid)||null;}
  function refreshMeshList(preferredUuid=null){
    const values=meshes(),list=$('editMesh');
    const current=preferredUuid||selection?.uuid;
    list.replaceChildren();
    for(const [index,m] of values.entries())list.add(new Option((m.name||'Mesh '+(index+1))+' · '+index,m.uuid));
    if(values.length){
      list.value=values.some(v=>v.uuid===current)?current:values[0].uuid;
      selection=values.find(m=>m.uuid===list.value)||values[0];
    } else selection=null;
    list.disabled=!selection;
    for(const id of transformIds)$(id).disabled=!selection;
    $('editColor').disabled=!selection;
    $('editVisible').disabled=!selection;
    $('applyEdit').disabled=!selection;
    $('duplicateMesh').disabled=!selection;
    $('deleteMesh').disabled=!selection;
    $('undoEdit').disabled=!history.length;
    $('addPrimitive').disabled=!getRoot();
    $('sliceModel').disabled=!getRoot()||!meshes().length;
    readSelected();
  }
  function readSelected(){
    const obj=selected();if(!obj)return;
    const s=meshSnapshot(obj),values=[...s.position,...s.rotation.map(THREE.MathUtils.radToDeg),...s.scale];
    transformIds.forEach((id,i)=>$(id).value=Number(values[i].toFixed(4)));
    $('editVisible').checked=s.visible;
    if(s.color)$('editColor').value='#'+s.color;
  }
  function checkpoint(undo){
    history.push(undo);if(history.length>20)history.shift();
    $('undoEdit').disabled=false;
  }
  function apply(){
    const mesh=selected();if(!mesh)return;
    try{
      const nums=transformIds.map(id=>Number($(id).value));
      if(transformIds.some(id=>$(id).value.trim()===''))throw new Error('Every transform field needs a number.');
      const previous=meshSnapshot(mesh);
      applyMeshEdit(mesh,{position:nums.slice(0,3),rotation:nums.slice(3,6),
        scale:nums.slice(6,9),visible:$('editVisible').checked,color:$('editColor').value});
      checkpoint(()=>applySnapshot(mesh,previous));
      changed();onMessage('Applied position, rotation, scale and material edits.');
    }catch(err){onMessage('Editing failed: '+err.message,true)}
  }
  function add(){
    try{
      const object=addPrimitive(getRoot(),$('primitiveType').value);
      checkpoint(()=>object.parent?.remove(object));
      selection=object;changed();onMessage('Added a new editable '+$('primitiveType').value+' primitive.');
    }catch(err){onMessage(err.message,true)}
  }
  function duplicate(){
    try{
      const clone=duplicateMesh(selected());
      checkpoint(()=>clone.parent?.remove(clone));
      selection=clone;changed();onMessage('Duplicated mesh.');
    }catch(err){onMessage(err.message,true)}
  }
  function remove(){
    try{
      const mesh=selected(),parent=removeEditableMesh(mesh);
      checkpoint(()=>parent.add(mesh));
      selection=null;changed();onMessage('Removed selected mesh. Undo is available.');
    }catch(err){onMessage(err.message,true)}
  }
  function undo(){
    const action=history.pop();if(!action)return;
    try{action();selection=null;changed();onMessage('Last edit reversed.');}
    catch(err){onMessage('Undo failed: '+err.message,true)}
  }
  function supportPreview(mesh,supports,scale){
    clearHelpers();if(!supports.length)return;
    const scene=getStage()?.scene;if(!scene)return;
    const group=new THREE.Group();
    const color=new THREE.MeshStandardMaterial({color:0xe5ac60,transparent:true,opacity:0.72});
    for(const s of supports){
      const length=s.to-s.from;
      if(length<=0)continue;
      const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(s.radius/scale,s.radius/scale,length/scale,8),color);
      cylinder.position.set(s.x/scale+mesh.origin[0]/scale,(s.to+s.from)/(2*scale)+mesh.origin[2]/scale,
        -(s.y/scale+mesh.origin[1]/scale));
      cylinder.userData.modelViewHelper=true;
      group.add(cylinder);
    }
    scene.add(group);
    helpers=group;
  }
  function layerSection(){
    if(!print)return null;
    const index=Number($('sliceLayer').value);
    const height=Math.min((index+0.5)*print.preview.layerHeight,print.mesh.dimensions[2]-0.000001);
    return contoursAt(print.mesh,Math.max(0,height));
  }
  function draw(){
    if(!print)return;
    const canvas=$('sliceCanvas'),ctx=canvas.getContext('2d');
    if(!ctx)return;
    const width=canvas.width,height=canvas.height;
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#071522';ctx.fillRect(0,0,width,height);
    const section=layerSection();
    const [sizeX,sizeY]=print.mesh.dimensions;
    const scale=Math.min((width-40)/Math.max(sizeX,1),(height-40)/Math.max(sizeY,1));
    const ox=(width-sizeX*scale)/2,oy=(height-sizeY*scale)/2;
    const point=p=>[ox+p[0]*scale,height-oy-p[1]*scale];
    ctx.strokeStyle='#426270';ctx.lineWidth=1;ctx.strokeRect(ox,oy,sizeX*scale,sizeY*scale);
    for(const [paths,color] of [[section.loops,'#67ecc8'],[section.openPaths,'#ff988b']]){
      ctx.strokeStyle=color;ctx.lineWidth=2;
      for(const points of paths){
        ctx.beginPath();
        points.forEach((p,i)=>{const [x,y]=point(p);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});
        ctx.stroke();
      }
    }
    ctx.fillStyle='#eca65a';
    for(const s of print.supports){
      if(section.z<s.from||section.z>s.to)continue;
      const [x,y]=point([s.x,s.y]);
      ctx.beginPath();ctx.arc(x,y,Math.max(2,s.radius*scale),0,Math.PI*2);ctx.fill();
    }
    $('sliceIndex').textContent=(Number($('sliceLayer').value)+1)+' / '+print.preview.count+
      ' · Z '+section.z.toFixed(2)+' mm · '+section.loops.length+' loops'+
      (section.openPaths.length?' · '+section.openPaths.length+' open paths':'');
  }
  function printerSettings(){
    const profile=printerById($('printerProfile').value);
    const volume=['printerBedX','printerBedY','printerBedZ'].map(id=>Number($(id).value));
    const nozzle=Number($('printerNozzle').value);
    const filament=Number($('printerFilament').value);
    const margin=Number($('printerMargin').value);
    return {profile,volume,nozzle,filament,margin};
  }
  function selectPrinter(){
    const printer=printerById($('printerProfile').value);
    ['printerBedX','printerBedY','printerBedZ'].forEach((id,i)=>{
      $(id).value=printer.volume[i];
      $(id).disabled=printer.id!=='custom';
    });
    $('printerNozzle').value=printer.nozzle;
    $('printerFilament').value=printer.filament;
    $('slicerRecommendation').textContent=printer.name+' — suggested next step: '+printer.slicer+
      '. Model View checks footprint only; no G-code or machine connection.';
    invalidateSlice();
  }
  function fitLabel(checks,profile,layerHeight){
    const limits=profile.layer;
    const layerWarning=layerHeight<limits[0]||layerHeight>limits[1]?
      ' Selected layer height is outside this profile’s illustrative '+limits[0]+'–'+limits[1]+' mm range.':'';
    const element=$('printerFit');
    element.className='print-result '+(checks.fits?(checks.warnings.length||layerWarning?'fit-warning':'fit-pass'):'fit-fail');
    element.textContent=checks.fits?
      'Build envelope: FITS '+checks.modelSize.map(n=>n.toFixed(1)).join(' × ')+
        ' mm within usable '+checks.usable.map(n=>n.toFixed(1)).join(' × ')+
        ' mm. This is not printer-readiness certification.':
      'BUILD VOLUME EXCEEDED: '+checks.problems.join(' ');
    if(checks.warnings.length)element.textContent+=' '+checks.warnings.join(' ');
    element.textContent+=layerWarning;
    return checks.fits;
  }
  function slice(){
    if(!getRoot())return;
    $('sliceModel').disabled=true;
    try{
      const factor=Number($('unitScale').value);
      const mesh=extractPrintMesh(getRoot(),100000,factor);
      const preview=slicePreview(mesh,Number($('layerHeight').value));
      const topology=topologyReport(mesh);
      const supports=generateSupports(mesh,{enabled:$('enableSupports').checked,
        angle:Number($('overhangAngle').value),spacing:Number($('supportSpacing').value)});
      const settings=printerSettings();
      const checks=validatePrintFit({dimensions:mesh.dimensions,volume:settings.volume,
        nozzle:settings.nozzle,filament:settings.filament,
        layerHeight:preview.layerHeight,margin:settings.margin,supports});
      print={mesh,preview,supports,factor,settings,checks};
      fitLabel(checks,settings.profile,preview.layerHeight);
      $('sliceLayer').max=String(preview.count-1);
      $('sliceLayer').value='0';
      $('sliceViewer').hidden=false;
      $('printResult').textContent=preview.count+' layers · '+mesh.dimensions.map(n=>n.toFixed(1)).join(' × ')+
        ' mm · '+mesh.triangleCount.toLocaleString()+' triangles · '+supports.length+' support columns. '+
        (topology.isClosed?'Topology: no open edges detected. ':
        'WARNING: '+topology.boundaryEdges+' boundary edges and '+topology.nonManifoldEdges+
          ' non-manifold edges; repair model before printing. ')+
        'STL exported in millimetres (Z up).';
      supportPreview(mesh,supports,factor);
      $('saveStl').disabled=!checks.fits;
      draw();onMessage('Generated geometric layer slices and optional support columns.');
    } catch(err){
      invalidateSlice();$('printResult').textContent='Slicing failed: '+err.message;
      $('printerFit').className='print-result fit-fail';
      $('printerFit').textContent='Cannot check this print: '+err.message;
      onMessage('Slicing failed: '+err.message,true);
    }finally{$('sliceModel').disabled=!getRoot()||!meshes().length;}
  }
  function exportSvg(){
    if(!print)return;
    try{
      const section=layerSection();
      downloadBlob(fileName('model')+'-layer-'+(Number($('sliceLayer').value)+1)+'.svg',
        sliceSvg(section,print.mesh.dimensions),'image/svg+xml');
    }catch(err){onMessage('SVG export failed: '+err.message,true)}
  }
  function exportStl(){
    if(!print)return;
    if(!print.checks.fits){onMessage('Printer build-volume check failed; STL download is blocked until it fits.',true);return;}
    try{
      const data=exportPrintStl(print.mesh,print.supports);
      downloadBlob(fileName($('activeName').textContent||'model')+'-print.stl',data,'model/stl');
      onMessage('STL saved. Validate topology, dimensions and supports in a full 3D printer slicer.');
    }catch(err){onMessage('STL export failed: '+err.message,true)}
  }
  function savePrinterSetup(){
    if(!print)return;
    const data=exportPrintSetup({printer:print.settings.profile,
      volume:print.settings.volume,nozzle:print.settings.nozzle,
      filament:print.settings.filament,layerHeight:print.preview.layerHeight,
      margin:print.settings.margin,dimensions:print.mesh.dimensions,
      checks:print.checks,supportsCount:print.supports.length});
    downloadBlob(fileName($('activeName').textContent||'model')+'-printer-check.json',
      data,'application/json');
    onMessage('Printer check report saved. This is not a slicer-native printer profile.');
  }
  $('editMesh').addEventListener('change',()=>{selection=meshes().find(o=>o.uuid===$('editMesh').value)||null;readSelected()});
  $('applyEdit').addEventListener('click',apply);
  $('addPrimitive').addEventListener('click',add);
  $('duplicateMesh').addEventListener('click',duplicate);
  $('deleteMesh').addEventListener('click',remove);
  $('undoEdit').addEventListener('click',undo);
  $('enableSupports').addEventListener('change',e=>{
    $('overhangAngle').disabled=!e.target.checked;
    $('supportSpacing').disabled=!e.target.checked;
    invalidateSlice();
  });
  for(const id of ['layerHeight','unitScale','overhangAngle','supportSpacing']) $(id).addEventListener('change',invalidateSlice);
  $('sliceModel').addEventListener('click',slice);
  $('sliceLayer').addEventListener('input',draw);
  $('saveSlice').addEventListener('click',exportSvg);
  $('saveStl').addEventListener('click',exportStl);
  $('savePrintSetup').addEventListener('click',savePrinterSetup);
  $('printerProfile').addEventListener('change',selectPrinter);
  for(const id of ['printerBedX','printerBedY','printerBedZ','printerNozzle','printerFilament','printerMargin'])
    $(id).addEventListener('change',invalidateSlice);
  function reset(){
    clearHelpers();print=null;selection=null;history=[];
    $('printerFit').className='print-result';
    $('printerFit').textContent='Load a model and click Slice model to check its printer fit.';
    $('sliceViewer').hidden=true;
    $('printResult').textContent='Load a model and click Slice model to generate layer previews.';
    refreshMeshList();
  }
  selectPrinter();
  reset();
  return {reset,onModelLoaded:()=>{reset();refreshMeshList();}};
}
