/** Portable, read-only quality inspection of a Three.js scene. No uploads. */
import * as THREE from 'three';

const fmt = n => Number.isFinite(n) ? Number(n.toFixed(5)) : null;
const finding = (severity, code, message) => ({severity, code, message});

/** Audit the entire imported model, including nested meshes and animation clips. */
export function auditModel(root, animations = [], limits = {}) {
  if (!root?.traverse) throw new TypeError('A Three.js scene root is required');
  const triangleWarning = limits.triangleWarning ?? 200000;
  const findings = [];
  const stats = {meshes:0, vertices:0, triangles:0, materials:0, texturedMaterials:0,
    textures:0, bones:0, animations:animations.length, missingNormals:0, missingUVs:0,
    skinnedMeshes:0, zeroAreaMeshes:0};
  const materials = new Set();
  const textures = new Set();
  const bones = new Set();
  const materialKinds = new Set();
  const meshNames = [];
  let badVertices = false;
  root.traverse(object => {
    if (object.isBone) bones.add(object);
    if (!object.isMesh) return;
    const geo = object.geometry;
    stats.meshes++;
    meshNames.push(object.name || 'Mesh ' + stats.meshes);
    if (object.isSkinnedMesh) stats.skinnedMeshes++;
    const position = geo?.getAttribute?.('position');
    if (!position || !position.count) {
      findings.push(finding('error', 'NO_POSITIONS', (object.name || 'A mesh') + ' has no vertex positions.'));
      return;
    }
    stats.vertices += position.count;
    stats.triangles += Math.floor((geo.index?.count ?? position.count) / 3);
    if (!geo.getAttribute('normal')) {
      stats.missingNormals++;
      findings.push(finding('warning', 'MISSING_NORMALS', (object.name || 'Mesh') + ' has no vertex normals.'));
    }
    const palette = Array.isArray(object.material) ? object.material : [object.material];
    for (const mat of palette.filter(Boolean)) {
      materials.add(mat);
      materialKinds.add(mat.type);
      const maps = Object.entries(mat).filter(([,value]) => value?.isTexture);
      for (const [,map] of maps) textures.add(map);
      if (maps.length && !geo.getAttribute('uv')) {
        stats.missingUVs++;
        findings.push(finding('warning', 'MISSING_UVS', (object.name || 'Mesh') + ' uses textures but lacks UV coordinates.'));
      }
    }
    for (let i = 0; i < position.count; i++) {
      if (!Number.isFinite(position.getX(i)) || !Number.isFinite(position.getY(i)) ||
          !Number.isFinite(position.getZ(i))) {
        badVertices = true; break;
      }
    }
  });
  stats.bones = bones.size;
  stats.materials = materials.size;
  stats.textures = textures.size;
  stats.texturedMaterials = [...materials].filter(mat =>
    Object.values(mat).some(value => value?.isTexture)).length;
  if (!stats.meshes) findings.push(finding('error','EMPTY_SCENE','No meshes found in this scene.'));
  if (badVertices) findings.push(finding('error','INVALID_VERTICES','Some vertex positions are NaN or infinite.'));
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.isEmpty() ? new THREE.Vector3() : bounds.getSize(new THREE.Vector3());
  if (!bounds.isEmpty() && [size.x,size.y,size.z].some(n => !Number.isFinite(n))) {
    findings.push(finding('error','INVALID_BOUNDS','Model bounds are not finite.'));
  }
  if (stats.triangles > triangleWarning) findings.push(finding('warning','HIGH_TRIANGLE_COUNT',
    'This model has ' + stats.triangles.toLocaleString('en-US') + ' triangles; check your target device budget.'));
  if (!animations.length) findings.push(finding('info','NO_ANIMATIONS','No animation clips were found (fine for static models).'));
  if (stats.meshes && !findings.some(f => f.severity === 'error' || f.severity === 'warning'))
    findings.push(finding('success','HEALTHY_MODEL','No structural problems were detected by the available checks.'));
  const errors = findings.filter(x=>x.severity==='error').length;
  const warnings = findings.filter(x=>x.severity==='warning').length;
  return {schemaVersion:1, status:errors?'error':warnings?'warning':'pass', stats,
    bounds: {width:fmt(size.x), height:fmt(size.y), depth:fmt(size.z)},
    materialTypes:[...materialKinds].sort(), meshNames:meshNames.slice(0,200),
    findings};
}

export function reportJson(modelName, format, audit) {
  return JSON.stringify({app:'Model View', generatedAt:new Date().toISOString(),
    model:modelName, sourceFormat:format, ...audit},null,2);
}
