import {test} from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {RegionMapDiagram} from "../app/components/region-map";
import {diagramSchema} from "../lib/diagram-schema";
import {regionAdjacencies,regionMapSchema} from "../lib/region-map";
import {importWorksheet,exportWorksheet,editQuestion,buildPrompt} from "../lib/worksheet";
import {canSelect} from "../lib/teacher-review";
import fixture from "../examples/region-coloring-worksheet.json";

const diagram=regionMapSchema.parse(fixture.original_diagram);
test("첨부의 경계 공유 9쌍과 점 접촉 B–F·C–E를 구분한다",()=>{
  assert.deepEqual(regionAdjacencies(diagram).map(p=>p.join("")),["AB","AD","AE","BC","BE","CF","DE","DF","EF"]);
  const junction=diagram.boundaries.filter(b=>b.from==="J"||b.to==="J");
  assert.equal(junction.length,4);
  assert.deepEqual([...new Set(junction.flatMap(b=>b.regions))].sort(),["B","C","E","F"]);
  const markup=renderToStaticMarkup(createElement(RegionMapDiagram,{diagram}));
  assert.equal((markup.match(/data-boundary=/g)||[]).length,18);
  assert.equal((markup.match(/<text /g)||[]).length,6);
  assert.ok(markup.includes("입력된 경계 정보"));
});
test("영역 그림 파일 왕복·도형 필수·본문 수정 재확인을 유지한다",()=>{
  const data=importWorksheet(JSON.stringify(fixture));
  assert.equal(data.questions.length,3);
  for(const q of data.questions){assert.deepEqual(q.diagram,diagram);assert.equal(q.verification,"needs_review");}
  const changed=editQuestion(data.questions[0],{...data.questions[0],question:data.questions[0].question+" 조건을 확인하시오."});
  assert.equal(canSelect(changed,false,true),false);
  const roundtrip=importWorksheet(exportWorksheet(data.analysis,[changed]));
  assert.deepEqual(roundtrip.questions[0].diagram,diagram);
  assert.equal(roundtrip.questions[0].diagram_review_required,true);
  const missing=importWorksheet(JSON.stringify({...fixture,generated_questions:[{question:"영역을 칠하시오.",answer:"교사 확인",solution:"풀이"}]}));
  assert.equal(missing.questions[0].verification,"failed");
});
test("잘못된 참조·열린 영역·분리된 고리·제어점 개수·비유한 좌표를 거부한다",()=>{
  const cases=[
    {...diagram,vertices:[...diagram.vertices,diagram.vertices[0]]},
    {...diagram,boundaries:diagram.boundaries.map((b,i)=>i===0?{...b,from:"missing"}:b)},
    {...diagram,boundaries:diagram.boundaries.filter(b=>b.id!=="AB")},
    {...diagram,boundaries:diagram.boundaries.map((b,i)=>i===0?{...b,regions:["missing"]}:b)},
    {...diagram,boundaries:diagram.boundaries.map((b,i)=>i===0?{...b,controls:[{x:1,y:1}]}:b)},
    {...diagram,vertices:diagram.vertices.map((v,i)=>i===0?{...v,x:Infinity}:v)},
    {...diagram,boundaries:[...diagram.boundaries,...[{id:"a",from:"TL",to:"TR",regions:["A"]},{id:"b",from:"TR",to:"BL",regions:["A"]},{id:"c",from:"BL",to:"TL",regions:["A"]}]]},
  ];
  for(const d of cases)assert.equal(diagramSchema.safeParse(d).success,false);
});
test("예제의 색 수만 바꾸고 원본과 같은 경계를 사용한다",()=>{
  // 예제 자료 확인에만 쓰는 열거이다. 앱에는 자동 정답 계산 기능을 추가하지 않는다.
  const names=diagram.regions.map(r=>r.id),edges=regionAdjacencies(diagram);
  function count(k:number){const colors=new Map<string,number>();let total=0;function visit(i:number){if(i===names.length){total++;return;}const id=names[i];for(let c=0;c<k;c++){if(edges.some(([a,b])=>a===id&&colors.get(b)===c||b===id&&colors.get(a)===c))continue;colors.set(id,c);visit(i+1);colors.delete(id);}}visit(0);return total;}
  assert.equal(count(6),Number(fixture.answer));
  for(let i=0;i<3;i++)assert.equal(count(i+3),Number(fixture.generated_questions[i].answer));
  const prompt=buildPrompt("numbers",3);
  for(const text of ["region_map","같은 꼭짓점","controls"])assert.ok(prompt.includes(text));
});
