import {test} from "node:test";
import assert from "node:assert/strict";
import {diagramSchema,getGeometry,inferCircleChord} from "../lib/diagram-schema";
import {importWorksheet,exportWorksheet,buildPrompt} from "../lib/worksheet";

test("원·현 그림이 각 길이와 원 위 조건·수선·대칭을 만족한다",()=>{
  for(const [ab,ac] of [[10,4],[5,2],[10,6],[13,3]]) {
    const diagram=diagramSchema.parse({type:"circle_chord",ab,ac});assert.ok(diagram.type==="circle_chord");const g=getGeometry(diagram);
    const p=g.points.find(p=>p.id==="P")!,q=g.points.find(p=>p.id==="Q")!;
    assert.ok(Math.abs((p.x-ab/2)**2+p.y**2-(ab/2)**2)<1e-9);
    assert.equal(p.x,q.x);assert.equal(p.y,-q.y);assert.ok(p.x>ac);
    assert.equal(g.points.find(p=>p.id==="B")!.x,ab);assert.equal(g.points.find(p=>p.id==="C")!.x,ac);
  }
});
test("일반 삼각형 그림은 정의한 점·선·각을 유지하고 잘못된 참조는 거절한다",()=>{
  const triangle={type:"geometry",points:[{id:"A",x:0,y:0},{id:"B",x:4,y:0},{id:"C",x:0,y:3}],segments:[{from:"A",to:"B"}],right_angles:[{vertex:"A",from:"B",to:"C"}]};
  assert.equal(diagramSchema.safeParse(triangle).success,true);
  assert.equal(diagramSchema.safeParse({...triangle,segments:[{from:"A",to:"Z"}]}).success,false);
  assert.equal(diagramSchema.safeParse({...triangle,points:[{id:"A",x:0,y:0},{id:"A",x:1,y:1}]}).success,false);
  for(const diagram of [{type:"circle_chord",ab:5,ac:6},{type:"svg",content:"<script/>"},{type:"circle_chord",ab:Infinity,ac:1}])assert.equal(diagramSchema.safeParse(diagram).success,false);
});
test("원문에 도형이 있으면 생성 문제의 도형 누락을 차단하고 파일 왕복에서 유지한다",()=>{
  const data=importWorksheet(JSON.stringify({original_diagram:{type:"circle_chord",ab:10,ac:4},questions:[{question:"일반 문제",answer:"1",diagram_required:false}]}));
  assert.equal(data.analysis.original_diagram_required,true);assert.equal(data.questions[0].verification,"failed");
  const withDiagram=importWorksheet(JSON.stringify({original_diagram_required:true,questions:[{question:"도형 문제",answer:"1",diagram:{type:"circle_chord",ab:5,ac:2}}]}));
  const again=importWorksheet(exportWorksheet(withDiagram.analysis,withDiagram.questions));
  assert.deepEqual(again.questions[0].diagram,withDiagram.questions[0].diagram);assert.equal(again.questions[0].verification,"needs_review");
});
test("기존 수능 원·현 문장에서 도형만 복원하고 정답은 검사하지 않는다",()=>{
  const question="길이가 10인 선분 AB를 지름으로 하는 원과 선분 AB 위에 AC = 4인 점 C가 있다. ∠PCB = θ이고 선분 AB에 수직인 현 PQ가 있다. 삼각형 PCQ의 넓이를 구하시오.";
  const diagram=inferCircleChord(question);assert.ok(diagram);assert.equal(diagram.type,"circle_chord");
  const data=importWorksheet(JSON.stringify({questions:[{question,answer:"잘못된 정답일 수 있음"}]}));
  assert.ok(data.questions[0].diagram);assert.equal(data.questions[0].verification,"needs_review");
  assert.equal(inferCircleChord("삼각형 ABC의 넓이는?"),undefined);
});
test("AI 요청문이 원본·유사문제의 도형과 자체 검산을 요구한다",()=>{
  const prompt=buildPrompt("numbers",3);
  for(const keyword of ["original_diagram","diagram_required","circle_chord","직접 다시 검산","앱에는 정답 자동 계산기가 없습니다"])assert.ok(prompt.includes(keyword));
});
