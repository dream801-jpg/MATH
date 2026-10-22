import {test} from "node:test";
import assert from "node:assert/strict";
import {tokenizeMatrices} from "../lib/matrix";

test("문장 속 숫자·문자 행렬을 원래 행·열대로 읽는다",()=>{
  const tokens=tokenizeMatrices("A = [[0, 0], [6, 0]], B = [[a, b], [c, d]]이다.");
  const matrices=tokens.filter(t=>t.type==="matrix");
  assert.equal(matrices.length,2);assert.deepEqual(matrices[0].rows,[["0","0"],["6","0"]]);
  assert.deepEqual(matrices[1].rows,[["a","b"],["c","d"]]);
});
test("공백·줄바꿈·분수·음수와 직사각형 행렬을 처리한다",()=>{
  const matrix=tokenizeMatrices("[[ -1, 1/2, x+1 ],\n [ 0, 3, 4 ]] ")[0];
  assert.equal(matrix.type,"matrix");if(matrix.type==="matrix")assert.deepEqual(matrix.rows,[["-1","1/2","x+1"],["0","3","4"]]);
});
test("잘못된 행렬·빈 성분은 글자로 보존하며 내용을 잃지 않는다",()=>{
  for(const text of ["[[1, 2], [3]]", "[[1, ], [2, 3]]", "[[0,0],[6,0]", "일반 문제입니다.", "[1,2,3]"]) {
    const tokens=tokenizeMatrices(text);
    assert.equal(tokens.map(t=>t.type==="text"?t.text:t.original).join(""),text);
    assert.ok(tokens.every(t=>t.type==="text"));
  }
});
test("복수 행렬과 한글·조건·줄바꿈을 손실 없이 유지한다",()=>{
  const text="(가) A = [[0, 0], [12, 0]]\nBC = [[0, 0], [4p, 0]]이다.\n① 4 ② 5";
  assert.equal(tokenizeMatrices(text).map(t=>t.type==="text"?t.text:t.original).join(""),text);
});

test("함수 인수·집합 안 쉼표는 열 구분으로 해석하지 않는다",()=>{
  const token=tokenizeMatrices("[[f(x, y), 1], [g(x, y), 2]]")[0];
  assert.equal(token.type,"matrix");if(token.type==="matrix")assert.deepEqual(token.rows,[["f(x, y)","1"],["g(x, y)","2"]]);
  const set=tokenizeMatrices("[[{a,b}, 1], [{c,d}, 2]]")[0];
  assert.equal(set.type,"matrix");if(set.type==="matrix")assert.equal(set.rows[0].length,2);
});
test("3차원 배열과 짝이 맞지 않는 성분 괄호는 원문으로 보존한다",()=>{
  for(const text of ["[[[1,2],[3,4]],[[5,6],[7,8]]]","[[f(x, y, 1], [g(x, y, 2]]"]) {
    const tokens=tokenizeMatrices(text);
    assert.equal(tokens.map(t=>t.type==="text"?t.text:t.original).join(""),text);
    assert.ok(tokens.every(t=>t.type==="text"));
  }
});
