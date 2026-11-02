/** Non-destructive mesh-level edits. Operations work on imported Three.js scene graphs. */
import * as THREE from 'three';

export function editableMeshes(root) {
  const meshes=[];
  root?.traverse?.(obj=>{if(obj.isMesh&&!obj.userData?.modelViewHelper)meshes.push(obj)});
  return meshes;
}
export function meshSnapshot(mesh) {
  return {position:mesh.position.toArray(),rotation:[mesh.rotation.x,mesh.rotation.y,mesh.rotation.z],
    scale:mesh.scale.toArray(),visible:mesh.visible,
    color:mesh.material?.color?.getHexString?.()||null};
}
export function applySnapshot(mesh,snapshot) {
  if(!mesh||!snapshot)throw new Error('Mesh and snapshot required');
  mesh.position.fromArray(snapshot.position);
  mesh.rotation.set(...snapshot.rotation);
  mesh.scale.fromArray(snapshot.scale);
  mesh.visible=Boolean(snapshot.visible);
  if(snapshot.color&&mesh.material?.color)mesh.material.color.set('#'+snapshot.color);
  mesh.updateMatrixWorld(true);
}
export function applyMeshEdit(mesh,{position,rotation,scale,visible,color}) {
  if(!mesh?.isMesh)throw new Error('Select a mesh before editing');
  if(![...position,...rotation,...scale].every(Number.isFinite))throw new Error('Transform values must be finite numbers');
  if(scale.some(v=>Math.abs(v)<0.0001||Math.abs(v)>100000))throw new Error('Scale values must be nonzero and within 100,000.');
  mesh.position.set(...position);
  mesh.rotation.set(...rotation.map(THREE.MathUtils.degToRad));
  mesh.scale.set(...scale);
  mesh.visible=Boolean(visible);
  if(color){
    if(!/^#[0-9a-fA-F]{6}$/.test(color))throw new Error('Invalid color value');
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    for(const mat of mats) if(mat?.color)mat.color.set(color);
  }
  mesh.updateMatrixWorld(true);
}
export function addPrimitive(root,shape='box') {
  if(!root?.isObject3D)throw new Error('Load a model first');
  const geometry={
    box:()=>new THREE.BoxGeometry(10,10,10),
    sphere:()=>new THREE.SphereGeometry(6,24,16),
    cylinder:()=>new THREE.CylinderGeometry(5,5,12,24)
  }[shape]?.();
  if(!geometry)throw new Error('Unknown primitive');
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x6de0c6,roughness:0.6}));
  mesh.name=shape[0].toUpperCase()+shape.slice(1)+' '+(editableMeshes(root).length+1);
  root.add(mesh);
  return mesh;
}
export function duplicateMesh(mesh) {
  if(!mesh?.parent)throw new Error('Mesh has no parent');
  const clone=mesh.clone(false);
  clone.geometry=mesh.geometry.clone();
  clone.material=Array.isArray(mesh.material)?
    mesh.material.map(material=>material.clone()):mesh.material.clone();
  clone.position.x+=5;
  clone.name=(mesh.name||'Mesh')+' copy';
  mesh.parent.add(clone);
  return clone;
}
export function removeEditableMesh(mesh) {
  if(!mesh?.parent||!mesh.isMesh)throw new Error('Select a mesh');
  const parent=mesh.parent;
  parent.remove(mesh);
  return parent;
}
