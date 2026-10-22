import {test} from "node:test";
import assert from "node:assert/strict";
import {importWorksheet,buildPrompt} from "../lib/worksheet";

const load=(question:string)=>importWorksheet(JSON.stringify({questions:[{question,answer:"확인 필요",solution:"확인 필요"}]}));
test("일반 글자와 정상 행렬은 불필요한 표시 경고를 내지 않는다",()=>{
  assert.deepEqual(load("A = [[f(x, y), 1], [g(x, y), 2]]이다.").displayWarnings,[]);
  assert.deepEqual(load("(x + 1)/(x - 2), √(x + 1), x², log₂(x)").displayWarnings,[]);
});
test("미지원 수식·잘못된 행렬·제어문자·그림 코드를 불러오면 알린다",()=>{
  for(const [input,expected] of [["\\frac{1}{2}","LaTeX"],["$\\frac{1}{$","조판"],["[[1,2],[3]]","행렬"],["수식\f rac","제어문자"],['<svg><circle /></svg>',"HTML"]]) {
    const data=load(input);assert.ok(data.displayWarnings.some(w=>w.includes(expected)));
    assert.equal(data.questions[0].question,input.trim());
  }
});
test("요청문에 수식 범위·필수 그림·객관식·JSON 작성 규칙이 포함된다",()=>{
  const prompt=buildPrompt("similar",3);
  for(const rule of ["(x + 1)/(x - 2)","1/(2x)","√(x + 1)","연립방정식", "조각함수","log₂(x)","원문에 도형이 있으면", "임의로 생략하지 말고", "정답 번호와 값", "이스케이프", "최대 6행·6열"])assert.ok(prompt.includes(rule),rule);
});
