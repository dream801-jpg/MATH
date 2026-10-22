import {test} from "node:test";
import assert from "node:assert/strict";
import {checkQuestion,editQuestion,exportWorksheet,importWorksheet,buildPrompt} from "../lib/worksheet";
import {canSelect} from "../lib/teacher-review";
import {sampleWorksheets} from "../lib/sample-worksheets";
import english from "../examples/english-review-worksheet.json";

test("도형 세 형식 모두 본문 수정 시 별도 확인이 필요하고 일반 전체 선택으로 우회할 수 없다",()=>{
  for(const id of ["chord","triangle","trigonometry"]){
    const data=importWorksheet(JSON.stringify(sampleWorksheets.find(s=>s.id===id)!.data));
    const q=data.questions[0];
    const edited=editQuestion(q,{...q,question:q.question+" 조건을 수정함."});
    assert.equal(edited.diagram_review_required,true);
    assert.deepEqual(edited.diagram,q.diagram);
    assert.equal(canSelect(edited,false,true),false);
    assert.equal(canSelect(edited,true,true),true);
    const roundtrip=importWorksheet(exportWorksheet(data.analysis,[{...edited,retry:true,work_space:"wide"}]));
    assert.equal(roundtrip.questions[0].diagram_review_required,true);
    assert.equal(roundtrip.questions[0].retry,true);
    assert.equal(roundtrip.questions[0].work_space,"wide");
    assert.equal(canSelect(roundtrip.questions[0],false,true),false);
    assert.equal(editQuestion(q,{...q,answer:q.answer+" 확인"}).diagram_review_required,false);
  }
});
test("빈 풀이와 과거 안내문을 구분하고 교사 허용이 있어야 선택하며 빈 본문·정답은 거부한다",()=>{
  for(const solution of [undefined,"","  ","풀이가 없습니다. AI에 풀이를 요청하거나 직접 입력해 주세요."]){
    const q=checkQuestion({question:"다음 방정식을 푸시오. 2x = 4",answer:"2",solution},"q");
    assert.equal(q.solution_missing,true);assert.equal(canSelect(q,true,false),false);assert.equal(canSelect(q,true,true),true);
  }
  for(const question of ["","   ","\\n"])assert.throws(()=>checkQuestion({question,answer:"2"},"q"));
  assert.throws(()=>checkQuestion({question:"2x = 4",answer:""},"q"));
  const q=checkQuestion({question:"2x = 4",answer:"2",solution:"양변을 2로 나눈다.",solution_missing:true},"q");
  assert.equal(q.solution_missing,false);
});
test("영어 예제의 두 빈칸과 어법 오류를 복원하면 문장·어휘·순서가 원본과 정확히 같다",()=>{
  const body=(s:string)=>s.split("[지문]\n")[1].split("\n[보기]")[0];
  const base=body(english.original_problem).replace("________","evidence rather than expectation");
  const [first,second,third]=english.generated_questions;
  assert.equal(body(first.question).replace("________","the same amount of water"),base);
  assert.equal(body(second.question).replace("________","careful records"),base);
  assert.notEqual(first.question.indexOf("________"),second.question.indexOf("________"));
  assert.equal(body(third.question).replace(/[①②③④⑤]\(([^)]+)\)/g,"$1").replace("was different","were different"),base);
  assert.deepEqual(english.generated_questions.map(q=>q.answer[0]),["②","⑤","④"]);
});
test("수업 조건·목적을 두 과목에 적용하고 영어는 개수 강제보다 타당성을 우선한다",()=>{
  for(const subject of ["math","english"] as const){
    const p=buildPrompt("numbers",5,"",{subject,englishMode:"retarget",englishType:"retain",study:{grade:"중2",scope:"일차방정식",methods:"등식의 성질",mistake:"부호 실수",purpose:"independent"}});
    for(const text of ["중2","등식의 성질","부호 실수","hint는 빈 문자열"])assert.ok(p.includes(text));
    if(subject==="math")for(const text of ["정의역","해의 개수","무연근"])assert.ok(p.includes(text));
    else {assert.ok(p.includes("1~5개"));assert.ok(!p.includes("정확히 5개"));assert.ok(p.includes("개수보다 우선"));}
  }
});
