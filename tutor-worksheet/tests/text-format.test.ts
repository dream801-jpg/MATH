import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeTextBreaks,printText} from "../lib/text-format";
import {importWorksheet,exportWorksheet} from "../lib/worksheet";

test("일반 글자의 중복 줄바꿈을 복구하되 수식 명령과 행렬 줄바꿈은 보존한다",()=>{
  assert.equal(normalizeTextBreaks(String.raw`첫 줄\n둘째 줄\n\n셋째 줄`),"첫 줄\n둘째 줄\n\n셋째 줄");
  assert.equal(normalizeTextBreaks(String.raw`첫 줄\\n다음 줄`),"첫 줄\n다음 줄");
  const math=String.raw`$\nabla f\neq0$와 $$\begin{aligned}a&=1\\b&=2\end{aligned}$$`;
  assert.equal(normalizeTextBreaks(math),math);
  assert.equal(normalizeTextBreaks(String.raw`\neq \nabla \nu \newcommand`),String.raw`\neq \nabla \nu \newcommand`);
});
test("첨부된 긴 문제와 중복 인코딩 JSON 모두 내용 손실 없이 불러온다",()=>{
  const raw=fs.readFileSync("examples/absolute-integral-worksheet.json","utf8");
  const data=importWorksheet(raw),double=importWorksheet(JSON.stringify(raw));
  assert.deepEqual(data,double);assert.equal(data.questions.length,3);
  assert.deepEqual(data.displayWarnings,[]);
  const literal=importWorksheet(JSON.stringify({original_problem:String.raw`원본\n문제`,questions:[{question:String.raw`첫 줄\n둘째 줄 $\neq$`,answer:"1",solution:String.raw`풀이\n완료`}]}));
  assert.equal(literal.analysis.original_problem,"원본\n문제");
  assert.equal(literal.questions[0].question,"첫 줄\n둘째 줄 $\\neq$");
  assert.equal(importWorksheet(exportWorksheet(data.analysis,data.questions)).questions[0].solution,data.questions[0].solution);
});
test("출력 간격만 줄이고 수식·불러온 원문은 유지한다",()=>{
  const input="ㄱ.\n\n$$x=1$$\n\n풀이\n\n완료";
  assert.equal(printText(input,false),input);
  assert.equal(printText(input,true),"ㄱ.\n$$x=1$$\n풀이\n완료");
  const aligned="$$a=1\n\nb=2$$";assert.equal(printText(aligned,true),aligned);
});
