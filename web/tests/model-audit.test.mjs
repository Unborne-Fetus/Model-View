import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {auditModel, reportJson} from '../src/model-audit.js';

test('healthy primitive model includes geometry and good report', () => {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(2,3,4),new THREE.MeshStandardMaterial()));
  const report=auditModel(root, []);
  assert.equal(report.status,'pass');
  assert.equal(report.stats.meshes,1);
  assert.equal(report.stats.triangles,12);
  assert.equal(report.stats.vertices,24);
  assert.deepEqual(report.bounds,{width:2,height:3,depth:4});
  assert.ok(report.findings.some(x=>x.code==='HEALTHY_MODEL'));
  assert.ok(JSON.parse(reportJson('cube.glb','.glb',report)).generatedAt);
});

test('empty scene fails rather than claiming successful export readiness', () => {
  const report=auditModel(new THREE.Group());
  assert.equal(report.status,'error');
  assert.ok(report.findings.some(x=>x.code==='EMPTY_SCENE'));
});

test('missing normals is a warning', () => {
  const root=new THREE.Group(), geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
  root.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial()));
  const report=auditModel(root);
  assert.equal(report.status,'warning');
  assert.ok(report.findings.some(x=>x.code==='MISSING_NORMALS'));
});

test('textured geometry without UVs is flagged', () => {
  const geo=new THREE.BoxGeometry();
  geo.deleteAttribute('uv');
  const mat=new THREE.MeshStandardMaterial({map:new THREE.Texture()});
  const report=auditModel(new THREE.Mesh(geo,mat));
  assert.equal(report.stats.textures,1);
  assert.equal(report.stats.missingUVs,1);
  assert.ok(report.findings.some(x=>x.code==='MISSING_UVS'));
});

test('invalid vertex positions fail validation', () => {
  const geo=new THREE.BoxGeometry();
  geo.attributes.position.setX(0,NaN);
  const report=auditModel(new THREE.Mesh(geo,new THREE.MeshBasicMaterial()));
  assert.equal(report.status,'error');
  assert.ok(report.findings.some(x=>x.code==='INVALID_VERTICES'));
});

test('large triangle counts can be warned using a caller-defined budget', () => {
  const report=auditModel(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),[],{triangleWarning:5});
  assert.ok(report.findings.some(x=>x.code==='HIGH_TRIANGLE_COUNT'));
});
