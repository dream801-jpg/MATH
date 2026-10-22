import {test} from "node:test";
import assert from "node:assert/strict";
import {buildPrompt} from "../lib/worksheet";

test("원본 유형 유지에서 삽입 문장 복원·다른 문장 추출·유일 위치 확인을 요청한다",()=>{
  const prompt=buildPrompt("numbers",5,"",{subject:"english",englishMode:"retarget",englishType:"retain"});
  for(const rule of ["모든 생성 문제에 그 유형을 유지","원본 정답 위치에 넣어","원본의 주어진 문장과 다른 문장","기준 지문이 그대로 복원","문장 사이의 서로 다른 삽입 위치 다섯 곳","별도의 내용 선택지는 중복해서 만들지","두 곳 이상 타당하면 다른 문장","원본 유형 유지의 다른 유형"])assert.ok(prompt.includes(rule),rule);
  const shape=JSON.parse(prompt.slice(prompt.lastIndexOf('\n{')+1));
  assert.equal(shape.problem_type,"원본 유형 유지");
});

test("영어의 방식·개수·유형을 모두 반영하고 수학 요청문과 분리한다",()=>{
  for(const englishMode of ["retarget","light"] as const)for(const englishType of ["retain","blank","grammar","vocabulary","mixed"] as const)for(const count of [3,5,10]){
    const prompt=buildPrompt("numbers",count,"The world changes.",{subject:"english",englishMode,englishType});
    assert.ok(prompt.includes(`영어 변형문제 ${count}개`));
    assert.ok(prompt.includes("원문: The world changes."));
    assert.ok(!prompt.includes('"type":"geometry"'));
    assert.ok(!prompt.includes("자연스러운 수치와 정수"));
    assert.ok(prompt.includes(englishMode==="retarget"?"원문 유지: 원본 지문의 문장":"표현만 조금 변경: 각 문제에서"));
    assert.ok(prompt.includes("1~3곳"));
    assert.ok(prompt.includes("서로 다른 출제 지점"));
    assert.ok(prompt.includes("다섯 선택지를 실제로 각각 대입"));
    const shape=JSON.parse(prompt.slice(prompt.lastIndexOf('\n{')+1));
    assert.equal(shape.subject,"영어");assert.equal(shape.original_diagram_required,false);
    const types={retain:"원본 유형 유지",blank:"빈칸 추론",grammar:"어법",vocabulary:"문맥상 어휘",mixed:"빈칸 추론·어법·문맥상 어휘를 섞어서"};
    assert.equal(shape.problem_type,types[englishType]);
  }
});
test("원문 복원·의도적 오답 예외·변경 대조를 요구하고 수학의 기본 모드는 유지한다",()=>{
  const english=buildPrompt("numbers",3,"",{subject:"english",englishMode:"retarget",englishType:"grammar"});
  for(const rule of ["원본 정답으로 먼저 복원","의도적 오류","원문 → 변경","같은 빈칸과 보기 순서만 바꾼 중복","1~3곳","새 지문이나 새 사례를 만들지 마세요"])assert.ok(english.includes(rule));
  assert.equal(buildPrompt("numbers",3),buildPrompt("numbers",3,"",{subject:"math",englishMode:"light",englishType:"mixed"}));
  assert.ok(buildPrompt("numbers",3).includes("숫자만 변경"));
});
