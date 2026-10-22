import {test} from "node:test";
import assert from "node:assert/strict";
import {plainToTex,renderFormula,splitMath} from "../lib/math-display";
import {importWorksheet,exportWorksheet,buildPrompt} from "../lib/worksheet";

test("이전 파일의 적분 구간·중첩 지수·분수를 조판한다",()=>{
  const source="(1/4)∫[f(1), f(3)] g(x) dx + ∫[f(0), f(2)] (2^(4g(x))g′(x))/x dx = (47/2)√2";
  const tex=plainToTex(source);const html=renderFormula(tex);
  assert.ok(tex.includes("\\int_{f"));assert.ok(tex.includes("\\frac"));assert.ok(html?.includes("<msubsup>"));
  assert.ok(renderFormula(plainToTex("f(x) = 2^(2x + (1/2)cos(πx))")));
});
test("명시적 LaTeX와 한글을 분리하며 손상된 수식은 실패를 알린다",()=>{
  const text="값은 $\\frac{1}{2}$이다.\n$$\\int_{f(0)}^{f(2)} \\frac{2^{4g(x)}g'(x)}{x} dx$$";
  const pieces=splitMath(text);assert.equal(pieces.filter(p=>p.tex).length,2);
  assert.equal(pieces.map(p=>p.text).join(""),text);
  assert.ok(pieces.filter(p=>p.tex).every(p=>renderFormula(p.tex!,p.display)));
  assert.equal(renderFormula("\\frac{1}{"),null);
  assert.throws(()=>plainToTex("∫[f(0), f(2)"));
});
test("위험한 수식 명령을 실행하지 않고 오류 원문은 React 글자로 남긴다",()=>{
  assert.equal(renderFormula("\\includegraphics{https://example.com/a.png}"),null);
  assert.equal(renderFormula("\\htmlStyle{color:red}{x}"),null);
});
test("원본 정답·풀이와 LaTeX가 파일 왕복에서 유지된다",()=>{
  const data=importWorksheet(JSON.stringify({answer:"49",solution:"$\\frac{47}{2}\\sqrt{2}$",questions:[{question:"$x^2$",answer:"1"}]}));
  assert.deepEqual(data.displayWarnings,[]);
  const restored=importWorksheet(exportWorksheet(data.analysis,data.questions));
  assert.equal(restored.analysis.answer,"49");assert.equal(restored.analysis.solution,data.analysis.solution);
  assert.ok(buildPrompt("numbers",3).includes("원본을 풀지 못했거나"));
});
