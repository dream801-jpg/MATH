import {regionAdjacencies,type RegionMap} from "@/lib/region-map";

export function RegionMapDiagram({diagram:g}:{diagram:RegionMap}) {
  const all=[...g.vertices,...g.regions,...g.boundaries.flatMap(b=>b.controls||[])];
  const minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x)),minY=Math.min(...all.map(p=>p.y)),maxY=Math.max(...all.map(p=>p.y));
  const size=360,padding=22,scale=(size-padding*2)/Math.max(maxX-minX,maxY-minY,.01);
  const point=(p:{x:number;y:number})=>({x:size/2+(p.x-(minX+maxX)/2)*scale,y:size/2-(p.y-(minY+maxY)/2)*scale});
  const vertices=new Map(g.vertices.map(p=>[p.id,point(p)]));
  const adjacent=regionAdjacencies(g).map(([a,b])=>`${a}–${b}`).join(", ");
  return <figure className="problem-diagram region-map-diagram"><svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`영역 ${g.regions.map(r=>r.id).join(", ")}의 경계 그림`}>
    <title>영역 색칠 문제의 경계 그림</title><desc>경계를 공유하는 영역: {adjacent}. 점만 공유하면 이웃이 아닙니다. 입력된 경계 정보를 그림과 대조하세요.</desc>
    {g.boundaries.map(b=>{const a=vertices.get(b.from)!,z=vertices.get(b.to)!;const c=b.controls?.map(point);return <path key={b.id} data-boundary={b.id} d={`M ${a.x} ${a.y} ${c?`C ${c[0].x} ${c[0].y} ${c[1].x} ${c[1].y} ${z.x} ${z.y}`:`L ${z.x} ${z.y}`}`} className="diagram-stroke"/>;})}
    {g.regions.map(r=>{const p=point(r);return <text key={r.id} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="diagram-label">{r.id}</text>;})}
  </svg><figcaption>경계와 영역 이름을 표시한 개략도입니다. 점 접촉과 경계 공유를 구분해 확인하세요.</figcaption></figure>;
}
