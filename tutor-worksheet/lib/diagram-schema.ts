import {z} from "zod";
import {regionMapSchema} from "./region-map";

const coordinate=z.number().finite().min(-10000).max(10000);
const name=z.string().trim().min(1).max(12);
const geometry=z.object({
  type:z.literal("geometry"),
  points:z.array(z.object({id:name,x:coordinate,y:coordinate,label:z.string().max(12).optional(),position:z.enum(["above","below","left","right"]).default("above"),show:z.boolean().default(true)})).min(2).max(32),
  segments:z.array(z.object({from:name,to:name,dashed:z.boolean().default(false),label:z.string().max(30).optional()})).max(64).default([]),
  circles:z.array(z.object({center:name,radius:z.number().finite().positive().max(10000)})).max(8).default([]),
  polygons:z.array(z.object({vertices:z.array(name).min(3).max(16)})).max(8).default([]),
  angles:z.array(z.object({vertex:name,from:name,to:name,label:z.string().max(12).default("θ")})).max(12).default([]),
  right_angles:z.array(z.object({vertex:name,from:name,to:name})).max(12).default([]),
}).superRefine((data,ctx)=>{
  const names=new Set(data.points.map(p=>p.id));
  if(names.size!==data.points.length)ctx.addIssue({code:"custom",message:"점 이름은 중복될 수 없습니다."});
  const references=[...data.segments.flatMap(s=>[s.from,s.to]),...data.circles.map(c=>c.center),...data.polygons.flatMap(p=>p.vertices),...[...data.angles,...data.right_angles].flatMap(a=>[a.vertex,a.from,a.to])];
  if(references.some(n=>!names.has(n)))ctx.addIssue({code:"custom",message:"도형에서 참조하는 점이 없습니다."});
});
const circleChord=z.object({
  type:z.literal("circle_chord"),ab:z.number().finite().positive().max(10000),ac:z.number().finite().positive().max(10000),
  angle_degrees:z.number().finite().min(5).max(85).default(35),
}).superRefine((data,ctx)=>{if(data.ac>=data.ab)ctx.addIssue({code:"custom",message:"C는 선분 AB 내부에 있어야 합니다."});});
const functionGraph=z.object({
  type:z.literal("function_graph"),
  x_min:coordinate,x_max:coordinate,y_min:coordinate,y_max:coordinate,
  x_end_label:z.string().max(40).optional(),
  curves:z.array(z.object({kind:z.enum(["sin","cos"]),amplitude:coordinate,frequency:z.number().finite().positive().max(1000),phase:coordinate.default(0),vertical_shift:coordinate.default(0),label:z.string().max(60).optional()})).min(1).max(4),
  horizontal_lines:z.array(z.object({y:coordinate,label:z.string().max(40).optional()})).max(4).default([]),
  points:z.array(z.object({id:name,x:coordinate,y:coordinate,position:z.enum(["above","below","left","right"]).default("above")})).max(16).default([]),
}).superRefine((g,ctx)=>{
  if(g.x_max-g.x_min<0.000001||g.y_max-g.y_min<0.000001)ctx.addIssue({code:"custom",message:"그래프 범위가 올바르지 않습니다."});
  if(g.x_min>0||g.x_max<0||g.y_min>=0||g.y_max<=0)ctx.addIssue({code:"custom",message:"그래프 범위에 원점과 x축 위아래를 포함하세요."});
  if(g.curves.some(c=>c.frequency*(g.x_max-g.x_min)>40*Math.PI))ctx.addIssue({code:"custom",message:"그래프는 최대 20주기까지 표시합니다."});
  if(g.horizontal_lines.some(l=>l.y<g.y_min||l.y>g.y_max)||g.points.some(p=>p.x<g.x_min||p.x>g.x_max||p.y<g.y_min||p.y>g.y_max))ctx.addIssue({code:"custom",message:"점과 수평선은 그래프 범위 안에 있어야 합니다."});
  if(new Set(g.points.map(p=>p.id)).size!==g.points.length)ctx.addIssue({code:"custom",message:"점 이름은 중복될 수 없습니다."});
});
export const diagramSchema=z.discriminatedUnion("type",[circleChord,geometry,functionGraph,regionMapSchema]);
export type Diagram=z.infer<typeof diagramSchema>;
export type Geometry=z.infer<typeof geometry>;
export type FunctionGraph=z.infer<typeof functionGraph>;
export function graphValue(curve:FunctionGraph["curves"][number],x:number):number {
  return curve.amplitude*Math[curve.kind](curve.frequency*x+curve.phase)+curve.vertical_shift;
}

// 기존 원·현 문제 파일도 다시 만들 필요 없이 그림을 표시한다. 정답은 계산하지 않는다.
export function inferCircleChord(text:string):Diagram|undefined {
  const compact=text.replace(/\s/g,"");
  if(!["선분AB를지름으로하는원","∠PCB=θ","선분AB에수직","삼각형PCQ"].every(part=>compact.includes(part)))return;
  const ab=compact.match(/길이가(\d+(?:\.\d+)?)인선분AB/),ac=compact.match(/AC=(\d+(?:\.\d+)?)인점C/);
  if(!ab||!ac)return;
  const result=diagramSchema.safeParse({type:"circle_chord",ab:Number(ab[1]),ac:Number(ac[1])});
  if(result.success)return result.data;
}

// 원·현 유형의 좌표 계산은 그림을 그리기 위한 것이며 정답 검산과는 별개다.
export function getGeometry(diagram:Exclude<Diagram,{type:"function_graph"|"region_map"}>):Geometry {
  if(diagram.type==="geometry")return diagram;
  const {ab,ac,angle_degrees}=diagram;
  const theta=angle_degrees*Math.PI/180,k=ab-2*ac,d=ac*(ab-ac);
  const rho=(k*Math.cos(theta)+Math.sqrt(k*k*Math.cos(theta)**2+4*d))/2;
  const x=ac+rho*Math.cos(theta),y=rho*Math.sin(theta);
  return {type:"geometry",points:[
    {id:"A",x:0,y:0,position:"left",show:true},{id:"B",x:ab,y:0,position:"right",show:true},
    {id:"C",x:ac,y:0,position:"below",show:true},{id:"P",x,y,position:"above",show:true},
    {id:"Q",x,y:-y,position:"below",show:true},{id:"D",x,y:0,position:"right",show:false},
    {id:"O",x:ab/2,y:0,position:"below",show:false},
  ],circles:[{center:"O",radius:ab/2}],segments:[
    {from:"A",to:"B",dashed:false},{from:"C",to:"P",dashed:false},{from:"C",to:"Q",dashed:false},{from:"P",to:"Q",dashed:false},
  ],polygons:[{vertices:["C","P","Q"]}],angles:[{vertex:"C",from:"B",to:"P",label:"θ"}],right_angles:[{vertex:"D",from:"C",to:"P"}]};
}
