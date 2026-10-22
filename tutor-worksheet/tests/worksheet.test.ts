import {test} from "node:test";
import assert from "node:assert/strict";
import {buildPrompt,checkQuestion,exampleText,exportWorksheet,importWorksheet,MAX_IMPORT_BYTES} from "../lib/worksheet";

test("공통 요청문에 방식·개수·원문과 반환 형식을 넣는다",()=>{
  for(const mode of ["numbers","similar","applied"] as const) for(const count of [3,5,10]) {
    const prompt=buildPrompt(mode,count,"3x + 5 = 20");
    assert.ok(prompt.includes(`유사문제 ${count}개`));assert.ok(prompt.includes("3x + 5 = 20"));assert.ok(prompt.includes("generated_questions"));
  }
});
test("정답 계산 없이 모든 예제 문제를 사용자 확인 대상으로 가져온다",()=>{
  const data=importWorksheet(exampleText);assert.equal(data.questions.length,5);
  assert.ok(data.questions.every(q=>q.verification==="needs_review"));
  const wrong=checkQuestion({question:"x=1",answer:"99",solution:"AI 풀이"},"q");
  assert.equal(wrong.verification,"needs_review");
});
test("코드 블록·UTF-8 BOM·숫자 정답·메타 정보 누락을 허용한다",()=>{
  const text=JSON.stringify({questions:[{question:"2x = 4",answer:2}]});
  const data=importWorksheet(`\uFEFF설명\n\`\`\`json\n${text}\n\`\`\``);
  assert.equal(data.questions[0].answer,"2");assert.equal(data.analysis.unit,"");
  assert.equal(data.questions[0].solution,"");assert.equal(data.questions[0].solution_missing,true);
});
test("기존 중첩 구조와 문제 배열만 있는 파일도 지원한다",()=>{
  const questions=[{question:"x = 3",answer:"3",solution:"해는 3입니다."}];
  assert.equal(importWorksheet(JSON.stringify({analysis:{unit:"방정식"},questions})).analysis.unit,"방정식");
  assert.equal(importWorksheet(JSON.stringify(questions)).questions.length,1);
});
test("외부 파일의 검증 완료 주장을 신뢰하지 않는다",()=>{
  const data=importWorksheet(JSON.stringify({questions:[{question:"3x+5=20",answer:"99",verification:"calculated"}]}));
  assert.equal(data.questions[0].verification,"needs_review");
});
test("깨진 JSON·빈 목록·필수 항목 누락·과대 입력을 거절한다",()=>{
  for(const value of ["", "{", "null", '{"questions":[]}', '{"questions":[{"question":"x=1"}]}',JSON.stringify({questions:Array(31).fill({question:"x=1",answer:"1"})})]) assert.throws(()=>importWorksheet(value));
  assert.throws(()=>importWorksheet("가".repeat(MAX_IMPORT_BYTES/2)),/1MB/);
  assert.throws(()=>importWorksheet('```json\n{}\n```\n```json\n{}\n```'),/한 개/);
});
test("문제 파일 왕복 시 한글·수식·정답을 유지하며 확인 상태는 저장하지 않는다",()=>{
  let data=importWorksheet(exampleText);
  for(let i=0;i<5;i++)data=importWorksheet(exportWorksheet(data.analysis,data.questions));
  assert.equal(data.analysis.unit,"일차방정식");assert.equal(data.questions[0].answer,"6");
  assert.ok(!exportWorksheet(data.analysis,data.questions).includes('"verification"'));
});
