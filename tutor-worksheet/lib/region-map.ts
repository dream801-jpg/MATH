import {z} from "zod";

const coordinate=z.number().finite().min(-10000).max(10000);
const id=z.string().trim().min(1).max(12).regex(/^[\p{L}\p{N}_-]+$/u,"이름에는 글자·숫자·밑줄·붙임표만 사용할 수 있습니다.");
const position=z.object({x:coordinate,y:coordinate});
export const regionMapSchema=z.object({
  type:z.literal("region_map"),
  vertices:z.array(position.extend({id})).min(3).max(64),
  regions:z.array(position.extend({id})).min(2).max(16),
  boundaries:z.array(z.object({id,from:id,to:id,regions:z.array(id).min(1).max(2),controls:z.array(position).length(2).optional()})).min(3).max(96),
}).superRefine((g,ctx)=>{
  const vertices=new Set(g.vertices.map(p=>p.id)),regions=new Set(g.regions.map(r=>r.id));
  const issue=(message:string)=>ctx.addIssue({code:"custom",message});
  if(vertices.size!==g.vertices.length||regions.size!==g.regions.length||new Set(g.boundaries.map(b=>b.id)).size!==g.boundaries.length)issue("꼭짓점·영역·경계 이름은 각 종류 안에서 중복될 수 없습니다.");
  if(g.boundaries.some(b=>!vertices.has(b.from)||!vertices.has(b.to)||b.from===b.to||new Set(b.regions).size!==b.regions.length||b.regions.some(r=>!regions.has(r)))){issue("경계의 꼭짓점·영역 참조가 올바르지 않습니다.");return;}
  // 각 영역의 경계가 하나의 닫힌 고리인지 검사한다. 곡선 교차·라벨 위치는 교사가 대조한다.
  for(const r of g.regions){
    const edges=g.boundaries.filter(b=>b.regions.includes(r.id)),neighbors=new Map<string,string[]>();
    for(const b of edges){neighbors.set(b.from,[...(neighbors.get(b.from)||[]),b.to]);neighbors.set(b.to,[...(neighbors.get(b.to)||[]),b.from]);}
    const seen=new Set<string>(),pending=[edges[0]?.from];
    while(pending.length){const v=pending.pop();if(!v||seen.has(v))continue;seen.add(v);pending.push(...(neighbors.get(v)||[]));}
    if(edges.length<2||[...neighbors.values()].some(a=>a.length!==2)||seen.size!==neighbors.size)issue(`${r.id} 영역의 경계가 하나의 닫힌 고리가 아닙니다.`);
  }
});
export type RegionMap=z.infer<typeof regionMapSchema>;
export function regionAdjacencies(g:RegionMap):[string,string][] {
  return [...new Set(g.boundaries.filter(b=>b.regions.length===2).map(b=>[...b.regions].sort().join("\u0000")))].sort().map(s=>s.split("\u0000") as [string,string]);
}
