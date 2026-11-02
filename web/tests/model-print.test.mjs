import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {editableMeshes,meshSnapshot,applyMeshEdit,applySnapshot,addPrimitive,duplicateMesh,removeEditableMesh} from '../src/model-editor.js';
import {extractPrintMesh,contoursAt,slicePreview,generateSupports,exportPrintStl,sliceSvg,topologyReport} from '../src/print-tools.js';

const cube=()=>new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshStandardMaterial());
test('editable mesh transform, duplicate, new geometry and deletion',()=>{
  const root=new THREE.Group(),m=cube();root.add(m);
  const initial=meshSnapshot(m);
  applyMeshEdit(m,{position:[10,3,-1],rotation:[0,90,0],scale:[2,1,1],visible:true,color:'#abcdef'});
  assert.equal(m.position.x,10);
  assert.equal(Math.round(THREE.MathUtils.radToDeg(m.rotation.y)),90);
  assert.equal(m.material.color.getHexString(),'abcdef');
  const clone=duplicateMesh(m);assert.notEqual(clone.geometry,m.geometry);
  assert.equal(editableMeshes(root).length,2);
  const newBox=addPrimitive(root,'box');assert.equal(editableMeshes(root).length,3);
  const parent=removeEditableMesh(newBox);assert.equal(parent,root);
  assert.equal(editableMeshes(root).length,2);
  applySnapshot(m,initial);
  assert.equal(m.position.x,0);
  assert.equal(m.scale.x,1);
});
test('slicing a closed cube produces closed XY loops and finite STL',()=>{
  const root=new THREE.Group();root.add(cube());
  const mesh=extractPrintMesh(root);
  assert.equal(mesh.triangleCount,12);
  assert.deepEqual(mesh.dimensions,[10,10,10]);
  assert.deepEqual(topologyReport(mesh),{boundaryEdges:0,nonManifoldEdges:0,isClosed:true});
  const preview=slicePreview(mesh,1);
  assert.equal(preview.count,10);
  const section=contoursAt(mesh,5);
  assert.ok(section.loops.length>=1,'expected a continuous perimeter');
  assert.equal(section.openPaths.length,0);
  const svg=sliceSvg(section,mesh.dimensions);
  assert.match(svg,/polyline/);
  const stl=exportPrintStl(mesh);
  assert.ok(stl.byteLength>100);
});
test('validates limits, empty scenes and extreme layer counts',()=>{
  assert.throws(()=>extractPrintMesh(new THREE.Group()),/No visible triangle/);
  const mesh=extractPrintMesh(cube(),100000,10);
  assert.deepEqual(mesh.dimensions,[100,100,100]);
  assert.throws(()=>slicePreview(mesh,0.01),/Layer height/);
  assert.throws(()=>slicePreview(mesh,0.05,50),/Too many layers/);
  assert.deepEqual(generateSupports(mesh,{enabled:false}),[]);
});
test('optional supports can be generated for an elevated horizontal overhang',()=>{
  const root=new THREE.Group();
  const base=new THREE.Mesh(new THREE.BoxGeometry(40,1,40),new THREE.MeshStandardMaterial());
  const overhead=new THREE.Mesh(new THREE.BoxGeometry(24,2,24),new THREE.MeshStandardMaterial());
  overhead.position.y=12;
  root.add(base,overhead);
  const mesh=extractPrintMesh(root);
  const candidates=generateSupports(mesh,{enabled:true,angle:55,spacing:4,maxSupports:400});
  assert.ok(candidates.length>0,'expected at least one column under elevated object');
  assert.ok(candidates.every(s=>s.to>s.from&&Number.isFinite(s.x)));
  const stl=exportPrintStl(mesh,candidates);
  assert.ok(stl.byteLength>100);
});

test('open mesh is correctly reported as non-watertight',()=>{
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,10,0,0,0,10,10],3));
  const report=topologyReport(extractPrintMesh(new THREE.Mesh(geo,new THREE.MeshBasicMaterial())));
  assert.equal(report.isClosed,false);
  assert.equal(report.boundaryEdges,3);
});
