import {getGeometry,type Diagram} from "@/lib/diagram-schema";
import {FunctionGraphDiagram} from "./function-graph";
import {RegionMapDiagram} from "./region-map";

export function ProblemDiagram({diagram}:{diagram?:Diagram}) {
  if(!diagram)return null;
  if(diagram.type==="function_graph")return <FunctionGraphDiagram graph={diagram}/>;
  if(diagram.type==="region_map")return <RegionMapDiagram diagram={diagram}/>;
  const g=getGeometry(diagram),byName=new Map(g.points.map(p=>[p.id,p]));
  const xs=g.points.map(p=>p.x),ys=g.points.map(p=>p.y);
  for(const circle of g.circles) {const c=byName.get(circle.center)!;xs.push(c.x-circle.radius,c.x+circle.radius);ys.push(c.y-circle.radius,c.y+circle.radius);}
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const width=420,height=310,padding=38,scale=Math.min((width-padding*2)/Math.max(maxX-minX,.01),(height-padding*2)/Math.max(maxY-minY,.01));
  const offsetX=(width-(maxX-minX)*scale)/2,offsetY=(height-(maxY-minY)*scale)/2;
  const point=(id:string)=>{const p=byName.get(id)!;return {x:offsetX+(p.x-minX)*scale,y:height-offsetY-(p.y-minY)*scale};};
  const unit=(from:{x:number;y:number},to:{x:number;y:number})=>{const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1;return {x:dx/length,y:dy/length};};
  const title=diagram.type==="circle_chord"?"선분 AB를 지름으로 하는 원과 점 C, 현 PQ, 삼각형 PCQ":"문제의 도형";
  return <figure className="problem-diagram"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
    <title>{title}</title>
    {g.polygons.map((polygon,i)=><polygon key={`polygon-${i}`} points={polygon.vertices.map(id=>{const p=point(id);return `${p.x},${p.y}`;}).join(" ")} className="diagram-shade"/>)}
    {g.circles.map((circle,i)=>{const p=point(circle.center);return <circle key={`circle-${i}`} cx={p.x} cy={p.y} r={circle.radius*scale} className="diagram-stroke"/>;})}
    {g.segments.map((segment,i)=>{const a=point(segment.from),b=point(segment.to);return <g key={`segment-${i}`}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeDasharray={segment.dashed?"5 4":undefined} className="diagram-stroke"/>{segment.label&&<text x={(a.x+b.x)/2} y={(a.y+b.y)/2-8} textAnchor="middle" className="diagram-label">{segment.label}</text>}</g>;})}
    {g.right_angles.map((angle,i)=>{const v=point(angle.vertex),a=unit(v,point(angle.from)),b=unit(v,point(angle.to)),s=9;return <polyline key={`right-${i}`} points={`${v.x+a.x*s},${v.y+a.y*s} ${v.x+(a.x+b.x)*s},${v.y+(a.y+b.y)*s} ${v.x+b.x*s},${v.y+b.y*s}`} className="diagram-stroke"/>;})}
    {g.angles.map((angle,i)=>{
      const v=point(angle.vertex),a=point(angle.from),b=point(angle.to);
      const first=Math.atan2(a.y-v.y,a.x-v.x);let delta=Math.atan2(b.y-v.y,b.x-v.x)-first;
      while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;
      const radius=22,end=first+delta,mid=first+delta/2;
      return <g key={`angle-${i}`}><path d={`M ${v.x+radius*Math.cos(first)} ${v.y+radius*Math.sin(first)} A ${radius} ${radius} 0 0 ${delta>0?1:0} ${v.x+radius*Math.cos(end)} ${v.y+radius*Math.sin(end)}`} className="diagram-stroke"/><text x={v.x+34*Math.cos(mid)} y={v.y+34*Math.sin(mid)+5} textAnchor="middle" className="diagram-label">{angle.label}</text></g>;
    })}
    {g.points.filter(p=>p.show).map(p=>{
      const v=point(p.id),dx=p.position==="left"?-10:p.position==="right"?10:0,dy=p.position==="above"?-10:p.position==="below"?20:5;
      return <text key={p.id} x={v.x+dx} y={v.y+dy} textAnchor={p.position==="left"?"end":p.position==="right"?"start":"middle"} className="diagram-label">{p.label??p.id}</text>;
    })}
  </svg><figcaption>도형은 위치 관계를 나타낸 개략도입니다.</figcaption></figure>;
}
