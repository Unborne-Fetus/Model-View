/** Browser-local geometric slicer for preview and exporting a support-augmented STL.
 * All coordinates in print space are millimetres, Z up. Assumes imported units are mm.
 * This is NOT a production G-code engine: no printer motion commands are generated.
 */
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

const EPS = 1e-6;
const key = p => `${Math.round(p[0]*10000)},${Math.round(p[1]*10000)}`;
const finite = n => Number.isFinite(n);
const between = (n,min,max) => n>=min-EPS&&n<=max+EPS;

export function extractPrintMesh(root, maxTriangles=100000) {
  if (!root?.traverse) throw new Error('Load a model first.');
  root.updateWorldMatrix(true,true);
  const raw = [];
  root.traverse(mesh => {
    if (!mesh.isMesh || !mesh.visible || mesh.userData?.modelViewHelper || !mesh.geometry) return;
    const pos=mesh.geometry.getAttribute('position');
    if(!pos) return;
    const index=mesh.geometry.index;
    const count=Math.floor((index?.count ?? pos.count)/3);
    if(raw.length+count>maxTriangles) throw new Error('Model too complex for browser slicing (limit '+maxTriangles.toLocaleString()+' triangles).');
    const read=i=>{
      const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
      return [p.x,-p.z,p.y];
    };
    for(let i=0;i<count;i++){
      const a=read(index?index.getX(i*3):i*3);
      const b=read(index?index.getX(i*3+1):i*3+1);
      const c=read(index?index.getX(i*3+2):i*3+2);
      if(![...a,...b,...c].every(finite))throw new Error('Invalid vertex coordinates. Repair the mesh before slicing.');
      raw.push([a,b,c]);
    }
  });
  if(!raw.length)throw new Error('No visible triangle meshes found.');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const tri of raw)for(const v of tri)for(let j=0;j<3;j++){min[j]=Math.min(min[j],v[j]);max[j]=Math.max(max[j],v[j]);}
  const triangles=raw.map(tri=>tri.map(v=>v.map((n,j)=>n-min[j])));
  return {triangles,origin:min,dimensions:max.map((n,j)=>n-min[j]),triangleCount:raw.length};
}

function trianglePlane(tri,z) {
  const hits=[];
  for(let j=0;j<3;j++){
    const a=tri[j],b=tri[(j+1)%3];
    // Half-open convention avoids double-counting exact vertex crossings.
    if((a[2]<=z&&b[2]>z)||(b[2]<=z&&a[2]>z)){
      const t=(z-a[2])/(b[2]-a[2]);
      hits.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
    }
  }
  if(hits.length!==2||Math.hypot(hits[0][0]-hits[1][0],hits[0][1]-hits[1][1])<EPS)return null;
  return hits;
}

export function contoursAt(mesh,z) {
  if(!Number.isFinite(z)||z<0||z>mesh.dimensions[2]+EPS)throw new RangeError('Slice height outside model.');
  const segments=[];
  for(const t of mesh.triangles){
    const minZ=Math.min(t[0][2],t[1][2],t[2][2]);
    const maxZ=Math.max(t[0][2],t[1][2],t[2][2]);
    if(z<minZ||z>=maxZ)continue;
    const cut=trianglePlane(t,z);if(cut)segments.push(cut);
  }
  const nodes=new Map(),edges=[];
  const add=(p,i)=>{
    const k=key(p);
    if(!nodes.has(k))nodes.set(k,{point:p,edges:[]});
    nodes.get(k).edges.push(i);
    return k;
  };
  for(const seg of segments){
    const id=edges.length;
    const a=add(seg[0],id),b=add(seg[1],id);
    edges.push({a,b});
  }
  const used=new Set(),loops=[],opens=[];
  for(let i=0;i<edges.length;i++) {
    if(used.has(i))continue;
    let edge=edges[i],start=edge.a,current=edge.b,previous=i;
    used.add(i);
    const pts=[nodes.get(start).point,nodes.get(current).point];
    while(current!==start && pts.length<segments.length+2){
      const options=nodes.get(current)?.edges.filter(id=>id!==previous&&!used.has(id))||[];
      if(!options.length)break;
      const nextId=options[0],next=edges[nextId],node=next.a===current?next.b:next.a;
      used.add(nextId);previous=nextId;current=node;
      pts.push(nodes.get(current).point);
    }
    if(current===start&&pts.length>=4)loops.push(pts);
    else opens.push(pts);
  }
  return {z,loops,openPaths:opens,segmentCount:segments.length};
}

export function slicePreview(mesh,layerHeight=0.2,maxLayers=1200) {
  const h=Number(layerHeight);
  if(!Number.isFinite(h)||h<0.05||h>2)throw new Error('Layer height must be from 0.05 to 2 mm.');
  if(mesh.dimensions[2]<=EPS)throw new Error('This model has no printable height.');
  const count=Math.ceil(mesh.dimensions[2]/h);
  if(count>maxLayers)throw new Error('Too many layers: '+count+'. Increase layer height (limit '+maxLayers+').');
  return {layerHeight:h,count,dimensions:mesh.dimensions,mesh};
}

function barycentricHeight(tri,x,y) {
  const [a,b,c]=tri;
  const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  if(Math.abs(den)<EPS)return null;
  const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den;
  const v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;
  const w=1-u-v;
  if(u<-EPS||v<-EPS||w<-EPS)return null;
  return u*a[2]+v*b[2]+w*c[2];
}

/** Basic grid-sampled vertical support candidate generation, not tree supports.
 * Trace down from downward-facing overhangs; stop at first solid surface or bed.
 */
export function generateSupports(mesh,{enabled=false,angle=55,spacing=8,radius=1,maxSupports=400}={}) {
  if(!enabled)return [];
  if(!between(angle,20,80)||!between(spacing,3,30)||!between(radius,0.3,3))
    throw new Error('Support settings are outside supported ranges.');
  const buckets=new Map();
  const threshold=-Math.cos(angle*Math.PI/180);
  for(const t of mesh.triangles){
    const [a,b,c]=t;
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2];
    const vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const nz=ux*vy-uy*vx;
    const length=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,nz);
    if(length<EPS||nz/length>=threshold)continue;
    const x=(a[0]+b[0]+c[0])/3,y=(a[1]+b[1]+c[1])/3;
    const height=(a[2]+b[2]+c[2])/3;
    if(height<2)continue;
    const gx=Math.round(x/spacing),gy=Math.round(y/spacing),k=gx+':'+gy;
    const point=[gx*spacing,gy*spacing];
    if(!between(point[0],0,mesh.dimensions[0])||!between(point[1],0,mesh.dimensions[1]))continue;
    const exact=barycentricHeight(t,...point);
    if(exact===null)continue;
    if(!buckets.has(k)||buckets.get(k).z<exact)buckets.set(k,{x:point[0],y:point[1],z:exact});
  }
  if(buckets.size>maxSupports)throw new Error('Too many support candidates ('+buckets.size+'). Increase support spacing.');
  const supports=[];
  for(const candidate of buckets.values()){
    let below=0;
    for(const t of mesh.triangles){
      const hit=barycentricHeight(t,candidate.x,candidate.y);
      if(hit!==null&&hit<candidate.z-0.3&&hit>below)below=hit;
    }
    if(candidate.z-below<2)continue;
    supports.push({x:candidate.x,y:candidate.y,from:below,to:candidate.z-0.25,radius});
  }
  return supports;
}

export function buildPrintScene(mesh,supports=[]) {
  const group=new THREE.Group();
  const positions=new Float32Array(mesh.triangleCount*9);
  let offset=0;
  for(const tri of mesh.triangles)for(const v of tri){positions[offset++]=v[0];positions[offset++]=v[1];positions[offset++]=v[2];}
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  // STL is geometry-only, with units assumed mm.
  group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial()));
  for(const support of supports){
    const height=support.to-support.from;
    if(height<=0)continue;
    const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(support.radius,support.radius,height,10),new THREE.MeshStandardMaterial());
    cylinder.rotation.x=Math.PI/2;
    cylinder.position.set(support.x,support.y,(support.from+support.to)/2);
    group.add(cylinder);
  }
  return group;
}

export function exportPrintStl(mesh,supports=[]) {
  const scene=buildPrintScene(mesh,supports);
  try {return new STLExporter().parse(scene,{binary:true});}
  finally {scene.traverse(obj=>{obj.geometry?.dispose?.();obj.material?.dispose?.();});}
}

/** SVG is a real planar slice, but not a printer G-code file. */
export function sliceSvg(section,dimensions) {
  const [width,height]=dimensions;
  const x=Math.max(width,1),y=Math.max(height,1);
  const paths=[...section.loops,...section.openPaths].map(points=>'<polyline points="'+
    points.map(p=>p[0].toFixed(4)+','+(y-p[1]).toFixed(4)).join(' ')+
    '" fill="none" stroke="black" stroke-width="0.2"/>').join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+x+'mm" height="'+y+'mm" viewBox="0 0 '+x+' '+y+'">'+paths+'</svg>';
}
