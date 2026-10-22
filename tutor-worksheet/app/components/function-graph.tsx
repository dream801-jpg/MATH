import {graphValue,type FunctionGraph} from "@/lib/diagram-schema";

export function FunctionGraphDiagram({graph:g}:{graph:FunctionGraph}) {
  const width=480,height=330,left=52,right=428,top=40,bottom=280;
  const x=(v:number)=>left+(v-g.x_min)/(g.x_max-g.x_min)*(right-left);
  const y=(v:number)=>bottom-(v-g.y_min)/(g.y_max-g.y_min)*(bottom-top);
  const zeroX=x(Math.max(g.x_min,Math.min(g.x_max,0))),zeroY=y(Math.max(g.y_min,Math.min(g.y_max,0)));
  return <figure className="problem-diagram function-graph"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="삼각함수 곡선과 수평선, 교점의 그래프">
    <title>삼각함수 곡선과 수평선, 교점의 그래프</title>
    <svg x={left} y={top} width={right-left} height={bottom-top} viewBox={`${left} ${top} ${right-left} ${bottom-top}`} overflow="hidden">
      {g.curves.map((c,i)=>{
        const count=Math.max(400,Math.ceil(c.frequency*(g.x_max-g.x_min)*30));
        const path=Array.from({length:count+1},(_,k)=>{const v=g.x_min+(g.x_max-g.x_min)*k/count;return `${k?"L":"M"}${x(v).toFixed(3)},${y(graphValue(c,v)).toFixed(3)}`;}).join(" ");
        return <path key={i} d={path} className="diagram-stroke"/>;
      })}
    </svg>
    <line x1={left-14} y1={zeroY} x2={right+24} y2={zeroY} className="diagram-stroke"/>
    <path d={`M${right+16},${zeroY-4} L${right+24},${zeroY} L${right+16},${zeroY+4}`} className="diagram-stroke"/>
    <line x1={zeroX} y1={bottom+10} x2={zeroX} y2={top-18} className="diagram-stroke"/>
    <path d={`M${zeroX-4},${top-10} L${zeroX},${top-18} L${zeroX+4},${top-10}`} className="diagram-stroke"/>
    <text x={right+27} y={zeroY+20} className="diagram-label">x</text><text x={zeroX-18} y={top-15} className="diagram-label">y</text>
    <text x={zeroX-20} y={zeroY+22} className="diagram-label">O</text>
    {g.horizontal_lines.map((l,i)=><g key={i}><line x1={left-10} y1={y(l.y)} x2={right+20} y2={y(l.y)} className="diagram-stroke"/><text x={right+14} y={y(l.y)-10} textAnchor="end" className="diagram-label">{l.label??`y = ${l.y}`}</text></g>)}
    {g.curves.map((c,i)=><text key={i} x={right} y={top-10-i*20} textAnchor="end" className="diagram-label">{c.label??`y = ${c.amplitude} ${c.kind}(${c.frequency}x)`}</text>)}
    {g.x_end_label&&<><line x1={right} y1={zeroY} x2={right} y2={y(graphValue(g.curves[0],g.x_max))} strokeDasharray="4 4" className="diagram-stroke"/><text x={right} y={zeroY+25} textAnchor="middle" className="diagram-label">{g.x_end_label}</text></>}
    {g.points.map(p=><g key={p.id}><circle cx={x(p.x)} cy={y(p.y)} r="2.5" fill="currentColor"/><text x={x(p.x)+(p.position==="left"?-14:p.position==="right"?14:0)} y={y(p.y)+(p.position==="below"?22:-12)} textAnchor="middle" className="diagram-label">{p.id}</text></g>)}
  </svg><figcaption>입력된 좌표로 그린 그래프입니다. 문제 조건과 직접 대조하세요. 축의 가로·세로 배율은 다를 수 있습니다.</figcaption></figure>;
}
