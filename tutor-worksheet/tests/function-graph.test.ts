import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {diagramSchema,graphValue} from "../lib/diagram-schema";
import {importWorksheet,exportWorksheet,buildPrompt} from "../lib/worksheet";

const example=JSON.parse(fs.readFileSync("examples/trigonometric-graph-worksheet.json","utf8"));
test("원본과 변형 5개의 곡선·교점·거리 및 파일 왕복이 일치한다",()=>{
  const data=importWorksheet(JSON.stringify(example));
  assert.equal(data.questions.length,5);assert.deepEqual(data.displayWarnings,[]);
  const graphs=[data.analysis.original_diagram,...data.questions.map(q=>q.diagram)];
  const lengths=[8/3,4,16/3,2,8,4/3];
  graphs.forEach((g,i)=>{
    assert.ok(g?.type==="function_graph");if(g?.type!=="function_graph")return;
    const [a,b]=g.points;
    assert.ok(Math.abs(graphValue(g.curves[0],a.x)-1)<1e-10);
    assert.ok(Math.abs(graphValue(g.curves[0],b.x)-1)<1e-10);
    assert.ok(Math.abs(b.x-a.x-lengths[i])<1e-10);
    assert.ok(Math.abs(g.x_max*g.curves[0].frequency-2*Math.PI)<1e-10);
  });
  const restored=importWorksheet(exportWorksheet(data.analysis,data.questions));
  assert.deepEqual(restored.analysis.original_diagram,data.analysis.original_diagram);
  assert.deepEqual(restored.questions.map(q=>q.diagram),data.questions.map(q=>q.diagram));
  assert.ok(restored.questions.every(q=>q.verification==="needs_review"));
});
test("사인 위상·이동과 잘못된 범위·과도한 진동을 처리한다",()=>{
  const base=example.original_diagram;
  assert.equal(diagramSchema.safeParse(base).success,true);
  assert.equal(diagramSchema.safeParse({...base,x_min:1}).success,false);
  for(const change of [{x_max:0},{y_max:-3},{x_max:Infinity},{curves:[{kind:"eval",amplitude:2,frequency:1}]},{curves:[{kind:"cos",amplitude:2,frequency:100}]},{points:[{id:"A",x:99,y:1}]},{horizontal_lines:[{y:99}]}])assert.equal(diagramSchema.safeParse({...base,...change}).success,false);
  assert.ok(Math.abs(graphValue({kind:"sin",amplitude:3,frequency:2,phase:Math.PI/2,vertical_shift:1},0)-4)<1e-10);
  assert.ok(buildPrompt("numbers",5).includes('"type":"function_graph"'));
  assert.ok(!buildPrompt("numbers",5).includes("함수 곡선 그래프·입체도형"));
});
