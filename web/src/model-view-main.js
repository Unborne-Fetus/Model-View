/** Model View: standalone, generic, private-by-default 3D studio. */
import './model-view.css';
import { ModelStage } from './stage.js';
import { projectFromFiles, projectFromZip, loadModel, exportGlb, demoModel,
  downloadBlob, extension } from './model.js';
import { auditModel, reportJson } from './model-audit.js';

const $ = id => document.getElementById(id);
const COMMON = new Set(['.glb','.gltf','.fbx','.obj','.dae','.stl','.ply','.3ds']);
const IMAGE = new Set(['.png','.jpg','.jpeg','.webp','.bmp']);
const state = {stage:null, project:null, loaded:null, audit:null, busy:false,
  textureUrl:null, wireMaterials:new Map(), selectionToken:0};

function status(message, error = false) {
  $('statusLine').textContent = String(message);
  $('statusLine').classList.toggle('error',error);
}
function setBusy(value, message = 'Processing…') {
  state.busy = value;
  $('busyOverlay').hidden = !value;
  $('busyMessage').textContent = message;
  updateButtons();
}
function updateButtons() {
  const good = !!state.loaded && !state.busy;
  $('exportGlb').disabled = !good;
  $('exportReport').disabled = !good || !state.audit;
  $('savePng').disabled = !good;
  $('loadModel').disabled = state.busy || !$('modelSelect').value;
  $('previewTexture').disabled = state.busy || !$('textureSelect').value;
  $('batchAudit').disabled = state.busy || !(state.project?.models||[]).some(x=>COMMON.has(extension(x.path)));
}
function safeFileName(name) {
  return String(name).replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g,'_').slice(0,125) || 'model';
}
function resetLoaded() {
  state.selectionToken++;
  restoreMaterials();
  state.stage?.clear();
  state.loaded?.disposeAssets?.();
  state.loaded = null;
  state.audit = null;
  $('activeName').textContent='3D viewport';
  $('emptyState').hidden=false;
  $('healthLabel').textContent='WAITING FOR A MODEL';
  $('healthLabel').className='health';
  $('reportSubtitle').textContent='Load a 3D asset to inspect its contents.';
  for (const id of ['statMeshes','statVertices','statTriangles','statMaterials','statTextures','statBones'])
    $(id).textContent='—';
  $('clipSelect').replaceChildren(new Option('No animations',''));
  $('clipSelect').disabled=true;
  $('toggleAnimation').disabled=true;
  $('clipCount').textContent='';
  $('modelBounds').textContent='—';
  $('sourceFormat').textContent='—';
  $('findingsList').innerHTML='<p class="muted">No model inspected yet.</p>';
  $('issueCount').textContent='';
  updateButtons();
}
function restoreMaterials() {
  for (const [material,previous] of state.wireMaterials) material.wireframe=previous;
  state.wireMaterials.clear();
}
function applyWireframe(value) {
  restoreMaterials();
  if (!value || !state.loaded) return;
  state.loaded.root.traverse(object=>{
    if (!object.isMesh) return;
    for (const material of (Array.isArray(object.material)?object.material:[object.material]).filter(Boolean)) {
      if (typeof material.wireframe === 'boolean') {
        state.wireMaterials.set(material,material.wireframe);
        material.wireframe=true;
      }
    }
  });
}
function renderReport() {
  const audit = state.audit;
  if (!audit) return;
  const labels=[['statMeshes','meshes'],['statVertices','vertices'],['statTriangles','triangles'],
    ['statMaterials','materials'],['statTextures','textures'],['statBones','bones']];
  for(const [id,key] of labels) $(id).textContent=audit.stats[key].toLocaleString('en-US');
  const box=audit.bounds;
  $('modelBounds').textContent=[box.width,box.height,box.depth].map(n=>n===null?'—':n.toLocaleString('en-US')).join(' × ');
  const issues=audit.findings.filter(x=>x.severity==='warning'||x.severity==='error');
  const health=$('healthLabel');
  health.className='health '+audit.status;
  health.textContent=audit.status==='pass'?'✓ NO ISSUES DETECTED':audit.status==='warning'?
    '△ REVIEW RECOMMENDED':'! VALIDATION ERRORS';
  $('issueCount').textContent=issues.length+' issue'+(issues.length===1?'':'s');
  const container=$('findingsList');
  container.replaceChildren();
  for(const f of audit.findings.slice(0,80)) {
    const item=document.createElement('div');
    item.className='finding '+f.severity;
    const title=document.createElement('strong'); title.textContent=f.code.replaceAll('_',' ');
    const desc=document.createElement('p'); desc.textContent=f.message;
    item.append(title,desc); container.append(item);
  }
  if(audit.findings.length>80) {
    const note=document.createElement('p'); note.className='muted';
    note.textContent='Only the first 80 findings are shown here; the JSON report contains the complete list.';
    container.append(note);
  }
  $('reportSubtitle').textContent='Structural review of the currently opened model.';
}
function renderAnimations() {
  const result=state.loaded;
  const select=$('clipSelect');
  select.replaceChildren();
  if (!result?.animations?.length) select.add(new Option('No animations available',''));
  else result.animations.forEach((clip,i)=>select.add(new Option(clip.name||'Animation '+(i+1),String(i))));
  select.disabled=!result?.animations?.length;
  $('toggleAnimation').disabled=!result?.animations?.length;
  $('clipCount').textContent=result?.animations?.length??0;
  $('toggleAnimation').textContent='Pause animation';
}
function showResult(result,sourceFormat) {
  restoreMaterials();
  const previous=state.loaded;
  state.stage.setModel(result.root,result.animations||[]);
  previous?.disposeAssets?.();
  state.loaded=result;
  state.audit=auditModel(result.root,result.animations||[]);
  $('emptyState').hidden=true;
  $('activeName').textContent=result.selected?.split('/').pop()||'Demo model';
  $('sourceFormat').textContent=sourceFormat.toUpperCase().replace('.','');
  $('outputName').value=safeFileName(result.selected||'demo-model');
  renderReport();
  renderAnimations();
  applyWireframe($('wireToggle').checked);
  updateButtons();
  status('Loaded '+state.audit.stats.meshes+' mesh(es); '+state.audit.stats.triangles.toLocaleString('en-US')+' triangles. All processing is local.');
}
function filterModels() {
  const rows=(state.project?.models||[]).filter(x=>COMMON.has(extension(x.path)));
  const needle=$('modelSearch').value.trim().toLowerCase();
  const matched=rows.filter(x=>x.path.toLowerCase().includes(needle));
  const previous=$('modelSelect').value;
  const select=$('modelSelect'); select.replaceChildren();
  for(const model of matched.slice(0,1200)) select.add(new Option(model.path,model.path));
  if(matched.some(x=>x.path===previous)) select.value=previous;
  else if (select.options.length) select.selectedIndex = 0;
  $('modelCount').textContent=matched.length+'/'+rows.length;
  updateButtons();
}
function refreshTextures() {
  const entries=(state.project?.items||[]).filter(x=>IMAGE.has(extension(x.path)));
  const select=$('textureSelect');select.replaceChildren();
  for(const entry of entries.slice(0,800)) select.add(new Option(entry.path,entry.path));
  $('textureCount').textContent=String(entries.length);
  $('texturePicker').hidden=entries.length===0;
  closeTexture();
}
function closeTexture() {
  if(state.textureUrl) URL.revokeObjectURL(state.textureUrl);
  state.textureUrl=null;
  $('textureView').hidden=true;
  $('textureImage').removeAttribute('src');
}
async function previewTexture() {
  const entry=state.project?.items.find(x=>x.path===$('textureSelect').value);
  if(!entry||state.busy)return;
  closeTexture();
  try {
    const bytes=await entry.getBytes();
    const mime=extension(entry.path)==='.png'?'image/png':extension(entry.path)==='.webp'?'image/webp':
      extension(entry.path)==='.bmp'?'image/bmp':'image/jpeg';
    const url=URL.createObjectURL(new Blob([bytes],{type:mime}));
    state.textureUrl=url;
    const img=$('textureImage');
    img.onload=()=>{if(state.textureUrl===url) $('textureDetails').textContent=
      entry.path+' · '+img.naturalWidth+' × '+img.naturalHeight+' px';};
    img.onerror=()=>{if(state.textureUrl===url) $('textureDetails').textContent=
      'This browser cannot preview the selected texture.';};
    img.src=url;
    $('textureDetails').textContent=entry.path+' · loading preview…';
    $('textureView').hidden=false;
  }catch(error){status('Unable to preview texture: '+error.message,true)}
}
/** Load the selected model, or an explicit path for automatic single-file import. */
async function openSelected(preferredPath = null) {
  const project = state.project;
  const selected = typeof preferredPath === 'string' ? preferredPath : $('modelSelect').value;
  if (!project || !selected || state.busy) return false;
  if (!state.stage) {
    status('3D rendering is unavailable in this browser. Enable WebGL or try another browser.', true);
    return false;
  }
  const token = ++state.selectionToken;
  setBusy(true, 'Loading mesh, materials and animations…');
  try {
    const result = await loadModel(project, selected, message => status(message));
    if (token !== state.selectionToken || project !== state.project) {
      result.disposeAssets?.();
      return false;
    }
    showResult(result, extension(selected));
    return true;
  } catch (error) {
    status('Could not load ' + selected + ': ' + (error.message || error), true);
    return false;
  } finally {
    setBusy(false);
  }
}

/** Import selected files once, then open the only supported model automatically. */
async function importFiles(fileList) {
  // Snapshot before clearing the native file picker (particularly important in Safari).
  const files = Array.from(fileList || []);
  if (!files.length || state.busy) return;
  setBusy(true, 'Inspecting selected files…');
  let singleModel = null;
  let completed = false;
  try {
    const project = files.length === 1 && extension(files[0].name) === '.zip'
      ? await projectFromZip(files[0], message => status(message))
      : projectFromFiles(files);
    const normal = project.models.filter(row => COMMON.has(extension(row.path)));
    const native = project.models.length - normal.length;
    resetLoaded();
    state.project = project;
    refreshTextures();
    $('modelPicker').hidden = !normal.length;
    $('modelSearch').value = '';
    filterModels();
    $('importStatus').classList.remove('error');
    $('importStatus').textContent = project.items.length + ' file(s) · ' + normal.length +
      ' standard model(s) · ' + project.items.filter(row => IMAGE.has(extension(row.path))).length +
      ' image texture(s)' + (native ? ' · ' + native + ' specialized model(s) (legacy tools)' : '');
    singleModel = normal.length === 1 ? normal[0].path : null;
    if (singleModel) {
      // Native select elements may have no initial selectedIndex in some browsers.
      $('modelSelect').value = singleModel;
      status('Found ' + singleModel + '. Opening 3D preview…');
    } else if (normal.length) {
      status('Choose one of the ' + normal.length + ' models, then select Load model.');
    } else {
      status('No supported standard 3D model found. Try GLB, glTF, FBX, OBJ, DAE, STL, PLY or 3DS.', true);
    }
    completed = true;
  } catch (error) {
    state.project = null;
    $('modelPicker').hidden = true;
    $('texturePicker').hidden = true;
    $('importStatus').classList.add('error');
    $('importStatus').textContent = 'Import failed: ' + (error.message || error);
    status($('importStatus').textContent, true);
  } finally {
    setBusy(false);
  }
  if (completed && singleModel) return openSelected(singleModel);
  return completed;
}
async function auditBatch() {
  const project=state.project;
  if(!project||state.busy)return;
  const rows=project.models.filter(x=>COMMON.has(extension(x.path)));
  if(!rows.length)return;
  const cap=25;
  const results=[];
  setBusy(true,'Auditing model files locally…');
  try {
    for(const [index,item] of rows.slice(0,cap).entries()) {
      $('busyMessage').textContent='Checking '+(index+1)+' of '+Math.min(rows.length,cap)+': '+item.path;
      let result;
      try {
        result=await loadModel(project,item.path);
        results.push({path:item.path,format:extension(item.path),
          ...auditModel(result.root,result.animations||[])});
      } catch(error) {
        results.push({path:item.path,status:'error',error:error.message||String(error)});
      } finally {
        if(result) {
          result.disposeAssets?.();
          result.root.traverse(object=>{
            if(object.isMesh){
              object.geometry?.dispose?.();
              const mats=Array.isArray(object.material)?object.material:[object.material];
              for(const mat of mats.filter(Boolean))mat.dispose?.();
            }
          });
        }
      }
    }
    const report={app:'Model View',schemaVersion:1,kind:'batch-model-audit',
      generatedAt:new Date().toISOString(),source:project.label,
      totalModels:rows.length,audited:results.length,
      truncated:rows.length>cap,limit:cap,results};
    downloadBlob('model-view-batch-report.json',JSON.stringify(report,null,2),'application/json');
    status('Batch quality report saved for '+results.length+' of '+rows.length+' model(s).'+
      (rows.length>cap?' Limit: '+cap+' models per batch.':''));
  } catch(error) {status('Batch audit failed: '+error.message,true)}
  finally {setBusy(false)}
}
async function exportCurrent() {
  if(!state.loaded||state.busy)return;
  setBusy(true,'Writing binary glTF…');
  try {
    // A diagnostic wireframe view must not change the exported materials.
    const wire=$('wireToggle').checked;restoreMaterials();
    let blob;
    try {blob=await exportGlb(state.loaded.root,state.loaded.animations||[])}
    finally {applyWireframe(wire)}
    downloadBlob(safeFileName($('outputName').value)+'.glb',blob,'model/gltf-binary');
    status('GLB export created locally.');
  } catch(error) {status('Export failed: '+error.message,true)}
  finally {setBusy(false)}
}
function exportReport() {
  if(!state.audit||!state.loaded)return;
  const name=state.loaded.selected||'demo-model';
  const json=reportJson(name,extension(name),state.audit);
  downloadBlob(safeFileName(name)+'-report.json',json,'application/json');
  status('Quality report downloaded.');
}
async function downloadScreenshot() {
  if(!state.stage||!state.loaded||state.busy)return;
  try {
    state.stage.renderer.render(state.stage.scene,state.stage.camera);
    const blob=await new Promise(resolve=>state.stage.renderer.domElement.toBlob(resolve,'image/png'));
    if(!blob)throw Error('Canvas screenshot unavailable in this browser.');
    downloadBlob(safeFileName(state.loaded.selected||'model')+'.png',blob,'image/png');
    status('Preview PNG saved.');
  }catch(error){status('Screenshot failed: '+error.message,true)}
}
function loadDemo() {
  if(state.busy||!state.stage)return;
  resetLoaded();
  state.project=null;
  $('modelPicker').hidden=true;
  $('texturePicker').hidden=true;
  closeTexture();
  $('importStatus').textContent='Built-in demonstration scene · no files imported';
  showResult({...demoModel(),selected:'demo-model.glb'},'.glb');
}
function events() {
  $('openFiles').addEventListener('click',e=>{e.stopPropagation();$('filesInput').click()});
  $('openFolder').addEventListener('click',()=>$('folderInput').click());
  $('filesInput').addEventListener('change',e=>{const files=Array.from(e.target.files||[]);e.target.value='';void importFiles(files);});
  $('folderInput').addEventListener('change',e=>{const files=Array.from(e.target.files||[]);e.target.value='';void importFiles(files);});
  $('tryDemo').addEventListener('click',loadDemo);
  $('dropZone').addEventListener('click',e=>{if(e.target.closest('button'))return;$('filesInput').click();});
  $('dropZone').addEventListener('keydown',e=>{
    if(e.target===$('dropZone')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();$('filesInput').click();}
  });
  for(const name of ['dragenter','dragover']) $('dropZone').addEventListener(name,e=>{
    e.preventDefault();$('dropZone').classList.add('dragging')});
  for(const name of ['dragleave','drop']) $('dropZone').addEventListener(name,e=>{
    e.preventDefault();$('dropZone').classList.remove('dragging');
    if(name==='drop')importFiles(e.dataTransfer?.files);
  });
  window.addEventListener('dragover',e=>e.preventDefault());
  window.addEventListener('drop',e=>{e.preventDefault();if(e.dataTransfer?.files?.length)importFiles(e.dataTransfer.files)});
  $('modelSearch').addEventListener('input',filterModels);
  $('loadModel').addEventListener('click',()=>void openSelected());
  $('batchAudit').addEventListener('click',auditBatch);
  $('modelSelect').addEventListener('dblclick',()=>void openSelected());
  $('modelSelect').addEventListener('change',updateButtons);
  $('textureSelect').addEventListener('change',updateButtons);
  $('previewTexture').addEventListener('click',previewTexture);
  $('gridToggle').addEventListener('change',e=>state.stage?.setGrid(e.target.checked));
  $('axesToggle').addEventListener('change',e=>state.stage?.setAxes(e.target.checked));
  $('spinToggle').addEventListener('change',e=>state.stage?.setSpin(e.target.checked));
  $('wireToggle').addEventListener('change',e=>applyWireframe(e.target.checked));
  $('frame').addEventListener('click',()=>state.stage?.frame());
  $('exportGlb').addEventListener('click',exportCurrent);
  $('exportReport').addEventListener('click',exportReport);
  $('savePng').addEventListener('click',downloadScreenshot);
  $('clipSelect').addEventListener('change',e=>{
    if(state.stage?.playAnimation(Number(e.target.value))) $('toggleAnimation').textContent='Pause animation';
  });
  $('toggleAnimation').addEventListener('click',()=>{
    if(!state.stage)return;
    const playing=state.stage.toggleAnimation(Number($('clipSelect').value)||0);
    $('toggleAnimation').textContent=playing?'Pause animation':'Play animation';
  });
  window.addEventListener('beforeunload',()=>{
    restoreMaterials();closeTexture();state.loaded?.disposeAssets?.();state.stage?.dispose();
  });
}
function start() {
  events();
  try {
    state.stage=new ModelStage($('canvasHost'));
    state.stage.setGrid(true);
    status('Ready. Import a standard 3D model or choose the demo.');
  }catch(error) {
    status('Unable to start 3D preview: '+error.message,true);
    $('importStatus').textContent='3D rendering requires WebGL support in this browser.';
  }
  updateButtons();
}
start();
