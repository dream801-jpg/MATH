import { z } from "zod";
import { analysisSchema, questionSchema, type Analysis, type Mode, type Question,type SubjectMode,type EnglishMode,type EnglishQuestionType } from "./schema";
import {buildEnglishPrompt} from "./english-prompt";
import { getDisplayWarnings } from "./display-check";
import { inferCircleChord } from "./diagram-schema";
import {normalizeTextBreaks} from "./text-format";
import {solutionMissing} from "./teacher-review";
import {studyInstructions,type StudyContext} from "./study-context";

export const MAX_IMPORT_BYTES=1024*1024;
export function checkQuestion(q:unknown,id:string):Question {
  const checked=questionSchema.parse(q);
  for(const field of ["question","answer","solution","hint"] as const)checked[field]=normalizeTextBreaks(checked[field]);
  questionSchema.parse(checked);
  checked.diagram??=inferCircleChord(checked.question);
  const missing=checked.diagram_required&&!checked.diagram;
  return {...checked,id,solution_missing:solutionMissing(checked.solution),verification:missing?"failed":"needs_review",verification_note:missing?"필수 도형이 없습니다. AI에 도형을 포함한 결과를 다시 요청하세요.":"AI가 작성한 정답·풀이입니다. 내용을 확인한 뒤 문제지에 선택하세요."};
}
export function editQuestion(q:Question,draft:Pick<Question,"question"|"answer"|"solution">):Question {
  return checkQuestion({...q,...draft,diagram_review_required:q.diagram_review_required||!!(q.diagram||q.diagram_required)&&draft.question.trim()!==q.question},q.id);
}
export function importWorksheet(source:string):{analysis:Analysis;questions:Question[];displayWarnings:string[]} {
  if(new TextEncoder().encode(source).length>MAX_IMPORT_BYTES) throw Error("문제 파일은 1MB 이하로 불러와 주세요.");
  let text=source.replace(/^\uFEFF/,"").trim();
  // AI 응답의 코드 블록 한 개를 허용하되, 여러 블록을 임의로 합치지는 않는다.
  const fences=[...text.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/gi)];
  if(fences.length>1) throw Error("JSON 코드 블록 한 개만 붙여넣어 주세요.");
  if(fences.length===1) text=fences[0][1].trim();
  let data:unknown;
  try {data=JSON.parse(text);if(typeof data==="string")data=JSON.parse(data);} catch {throw Error("내용을 읽지 못했습니다. AI 응답의 JSON 전체를 복사해 주세요. 마지막 괄호나 쉼표가 빠지지 않았는지 확인하세요.");}
  const root=Array.isArray(data)?{questions:data}:data;
  if(!root||typeof root!=="object") throw Error("문제 목록이 있는 JSON 파일이 필요합니다.");
  const obj=root as Record<string,unknown>;
  try {
    const analysis=analysisSchema.parse(obj.analysis??obj);
    for(const field of ["original_problem","answer","solution","warning"] as const)analysis[field]=normalizeTextBreaks(analysis[field]);
    analysis.original_diagram??=inferCircleChord(analysis.original_problem);
    analysis.original_diagram_required ||= !!analysis.original_diagram;
    const raw=z.array(questionSchema).min(1).max(30).parse(obj.generated_questions??obj.questions).map((q,i)=>checkQuestion(q,`question-${i+1}`));
    const displayWarnings=getDisplayWarnings([analysis.original_problem,analysis.answer,analysis.solution,...raw.flatMap(q=>[q.question,q.answer,q.solution])]);
    if(analysis.original_diagram_required&&!analysis.original_diagram)displayWarnings.push("원본 도형이 없습니다. AI에 original_diagram을 포함해 다시 요청하세요.");
    return {analysis,questions:raw.map((q,i)=>checkQuestion({...q,diagram_required:q.diagram_required||analysis.original_diagram_required},`question-${i+1}`)),displayWarnings};
  } catch(e) {
    if(e instanceof z.ZodError) {
      const path=e.issues[0]?.path.join(".");
      throw Error(`문제 형식이 맞지 않습니다${path?` (${path})`:""}. question(문제)과 answer(정답)가 있는 문제 1~30개가 필요합니다. 항목은 6,000자 이하로 작성해 주세요.`);
    }
    throw e;
  }
}
export function exportWorksheet(analysis:Analysis,questions:Question[]):string {
  // 사용자의 확인·선택 상태는 저장하지 않고 문제와 도형만 저장한다.
  return JSON.stringify({...analysis,generated_questions:questions.map(({question,answer,solution,hint,diagram,diagram_required,diagram_review_required,retry,work_space})=>({question,answer,solution,hint,diagram,diagram_required,diagram_review_required,retry,work_space}))},null,2);
}
export function buildPrompt(mode:Mode,count:number,original="",options?:{subject:SubjectMode;englishMode:EnglishMode;englishType:EnglishQuestionType;study?:StudyContext}):string {
  if(options?.subject==="english")return buildEnglishPrompt(options.englishMode,count,original,options.englishType)+studyInstructions(options.study);
  const instruction={numbers:"원본의 구조·문구·풀이 방법은 유지하고 숫자만 변경해 주세요.",similar:"원본의 핵심 개념과 풀이 방법을 유지하면서 구조나 표현을 조금 바꿔 주세요.",applied:"같은 개념을 쓰는 문장제 또는 조건을 추가한 응용 문제로 바꿔 주세요."}[mode];
  return `첨부한 사진 또는 아래 원문을 보고 개인 과외용 유사문제 ${count}개를 만들어 주세요.
${instruction}
${studyInstructions(options?.study)}
${original.trim()?`원문: ${original.trim()}\n`:""}
원문, 보기, 조건을 정확히 읽고 과목·단원·유형·핵심 개념·난이도를 분석해 주세요.
사진이 흐리거나 조건이 빠졌으면 추측해서 만들지 말고 먼저 다시 물어봐 주세요.
자연스러운 수치와 정수 또는 간단한 분수 정답을 사용하세요. 각 문제는 원문이나 그림을 보지 않아도 독립적으로 풀 수 있어야 합니다.
생성한 각 문제를 처음부터 다시 풀어서 정답과 해설, 조건, 변형 방식을 검토하고 틀린 문제는 수정한 뒤 보내 주세요.
앱에는 정답 자동 계산기가 없습니다. 문제·정답·풀이를 직접 다시 검산하고 풀이를 충분히 작성하세요. 다른 유형을 억지로 일차방정식으로 바꾸지 마세요.
이 앱은 일반 글자·LaTeX 수식·행렬과 정해진 JSON 형식의 도형을 표시합니다. 아래 규칙을 원본 문제·생성 문제·정답·해설에 모두 적용하세요.
- 수식은 LaTeX로 작성하고 문장 속 수식은 $...$, 독립된 수식은 $$...$$로 감싸세요. 적분 구간, 분수, 지수 전체를 수식 안에 넣어 교재처럼 조판되게 하세요. HTML, SVG, 이미지 링크, Markdown 표는 사용하지 마세요.
- 원본 문제를 먼저 독립적으로 풀고 answer에 원본 정답, solution에 충분한 원본 풀이를 반드시 작성하세요. 원본을 풀지 못했거나 확신이 없으면 정답을 추측하지 말고 answer에 확인 불가, warning에 이유를 쓰세요. 원본 풀이가 확정되지 않으면 유사문제 생성도 중단하고 먼저 알려 주세요. AI의 자체 검산은 정답 보장이 아닙니다.
- 수식이 들어간 올바른 JSON 문자열 예: ${JSON.stringify({question:"다음 값을 구하시오. $\\int_{0}^{1} \\frac{x^2}{2}\\,dx$"})}
- 아래 일반 글자 표기 예시는 이전 파일 호환용입니다. 새로 작성하는 분수·근호·지수·적분은 가능하면 LaTeX 수식을 우선 사용하세요.
- 행렬: [[0, 0], [6, 0]] 또는 [[a, b], [c, d]]. 행마다 열 수를 같게 쓰고 최대 6행·6열로 작성하세요. 앱이 행·열을 정렬해 둥근 괄호 행렬로 표시합니다. 행렬식은 det([[a, b], [c, d]])처럼 행렬과 구분하세요.
- 분수: 1/2 또는 (x + 1)/(x - 2). 여러 항의 분자·분모는 괄호로 묶으세요. 1/2x처럼 해석이 갈리는 표기는 쓰지 말고 x/2 또는 1/(2x)로 정확히 구분하세요.
- 근호: √(x + 1)처럼 근호의 범위를 괄호로 표시하세요. 지수·첨자는 x², x^(n + 1), a₁, a_(n + 1)처럼 범위를 명확히 쓰세요. 역행렬 A^(-1)과 분수 1/A를 혼동하지 마세요.
- 연립방정식·조각함수: 식마다 줄을 바꾸고 각 식의 조건을 함께 적으세요. 부등호 <, ≤, >, ≥와 구간 끝점 포함 여부를 원문과 동일하게 보존하세요.
- 로그·극한·합·적분: log₂(x), lim(x→0) (sin(x)/x), Σ(k=1..n) k², ∫[0, 1] x² dx처럼 밑·접근 방향·시작/끝·적분 변수를 빠뜨리지 마세요. 벡터는 '벡터 a = (1, 2)'처럼 벡터임을 명시하세요.
- 도형: 원문에 도형이 있으면 original_diagram_required를 true로 하고 original_diagram을 넣으세요. 생성 문제마다 diagram_required를 true로 하고 각 문제의 숫자·조건에 맞는 diagram을 반드시 넣으세요. 글로만 대체하거나 동일한 그림을 무조건 복사하지 마세요. 아래 지원 형식으로 정확히 표현할 수 없으면 임의로 생략하지 말고 먼저 알려 주세요.
- 도형은 임의 SVG·HTML 대신 아래 JSON으로 작성하세요. 좌표는 x가 오른쪽, y가 위쪽이며 점 이름은 고유하게 지정하세요. 선·원의 중심·다각형에서 참조한 점은 points에 모두 있어야 합니다.
  일반 도형 예: {"type":"geometry","points":[{"id":"A","x":0,"y":0,"position":"below"},{"id":"B","x":4,"y":0,"position":"below"},{"id":"C","x":1,"y":3,"position":"above"}],"segments":[{"from":"A","to":"B","label":"4"},{"from":"B","to":"C"},{"from":"C","to":"A"}],"polygons":[{"vertices":["A","B","C"]}]}
  원은 circles:[{"center":"O","radius":2}], 각은 angles:[{"vertex":"A","from":"B","to":"C","label":"θ"}], 직각 표시는 right_angles:[{"vertex":"A","from":"B","to":"C"}]로 추가하세요. 중심 O도 points에 정의하세요. points는 최대 32개, segments는 64개, circles와 polygons는 각각 8개입니다.
  AB를 지름으로 하는 원, 선분 AB 위의 C, ∠PCB=θ, AB에 수직인 현 PQ와 삼각형 PCQ 유형은 {"type":"circle_chord","ab":10,"ac":4,"angle_degrees":35}를 쓰세요. ab는 AB 길이, ac는 AC 길이이며 0 < ac < ab입니다. angle_degrees는 개략도를 그릴 각도이고 문제의 θ를 고정하는 조건이 아닙니다. 조건에 따라 앱이 원·현·삼각형·직각·θ 표시를 그립니다.
- 함수 그래프: 사인·코사인 곡선과 수평선은 function_graph 형식을 사용하세요. 각 곡선은 y = amplitude × kind(frequency × x + phase) + vertical_shift입니다. kind는 sin 또는 cos입니다. 주파수·위상·좌표는 π 문자열 대신 실제 유한한 숫자로 쓰세요. x_min ≤ 0 ≤ x_max, y_min < 0 < y_max이며 x_min < x_max여야 합니다. 원점과 x축 위아래를 포함하세요. 모든 점과 수평선은 범위 안에 있어야 합니다. 최대 곡선 4개, 수평선 4개, 점 16개, 20주기입니다. 교점을 points에 정확히 명시하세요. label과 x_end_label은 일반 글자·유니코드 표기로 작성하세요. 아래 예시는 y=2cos(ax), y=1, a=π/2일 때이며 문제마다 수치를 다시 계산하세요. 미지수 a의 답을 그림에 노출하지 않도록 label은 y = 2 cos(ax), 끝점 표시는 2π/a처럼 작성할 수 있습니다.
  함수 그래프 예: {"type":"function_graph","x_min":0,"x_max":4,"y_min":-2.5,"y_max":2.5,"x_end_label":"2π/a","curves":[{"kind":"cos","amplitude":2,"frequency":1.5707963267948966,"phase":0,"vertical_shift":0,"label":"y = 2 cos(ax)"}],"horizontal_lines":[{"y":1,"label":"y = 1"}],"points":[{"id":"A","x":0.6666666666666666,"y":1,"position":"above"},{"id":"B","x":3.3333333333333335,"y":1,"position":"above"}]}
- 좌표·길이·각·접선·교점이 문제 조건과 맞는지 그림도 검토하세요. 일반 도형의 직각 표시는 실제 직각일 때만 넣으세요. 도형이 필요 없는 문제에는 diagram을 생략하세요. 사인·코사인 외의 함수 그래프·입체도형·이미지 직접 삽입은 아직 지원하지 않으므로 필요한 경우 먼저 알려 주세요.
- 객관식: 보기 전체를 포함하고 정답이 정확히 한 개인지 확인하세요. 서로 같은 값을 나타내는 중복 보기를 피하고 정답 번호와 값이 일치하는지 검산하세요. 여러 문제의 정답 위치를 가능한 한 다양하게 배치하세요.
- 출력 간격: 문장을 단어마다 줄바꿈하거나 빈 줄을 반복하지 마세요. 보기 ㄱ·ㄴ·ㄷ은 각각 한 문단으로 쓰고, 문장 속 짧은 수식은 $...$를 사용하세요. 긴 독립 수식만 $$...$$로 작성하세요. 페이지 나눔·풀이 여백은 앱에서 설정하므로 문제 문자열에 공백이나 빈 줄을 넣어 만들지 마세요.
- JSON: 모든 문자열의 줄바꿈·따옴표·역슬래시는 JSON 규칙에 맞게 이스케이프하세요. 특히 LaTeX 역슬래시 하나는 JSON 문자열 안에서 역슬래시 두 개로 작성하세요. JSON 원문에서는 줄바꿈을 역슬래시 한 개와 n으로 이스케이프하세요. 파싱 후에도 역슬래시와 n이 글자로 남도록 중복 이스케이프하지 마세요. LaTeX 명령의 역슬래시 이스케이프와 구분하고, 마지막 쉼표·주석·불완전한 괄호를 넣지 마세요. 그림이나 표기를 완전히 보존할 수 없는 경우 warning에 구체적으로 알려 주세요.
아래 구조의 올바른 JSON 한 개만 반환하세요. 설명문을 앞뒤에 붙이지 마세요. generated_questions에는 정확히 ${count}개를 넣고 각 문제에 question, answer, solution을 모두 작성하세요.
- 영역 색칠·지도 색칠·격자 영역: 직선·곡선 경계로 나뉜 평면 그림은 region_map을 쓰세요. 영역 이름과 라벨 좌표는 regions, 교점·꼭짓점은 vertices, 경계는 boundaries에 정의합니다. x는 오른쪽, y는 위쪽이며 좌표는 실제 유한한 숫자입니다. 경계는 딱 한 번만 정의하고 regions에 경계 양쪽 영역 이름 두 개를 넣으세요. 바깥 경계는 영역 이름 한 개만 넣으세요. 같은 꼭짓점만 공유하고 경계는 공유하지 않으면 이웃이 아닙니다. 네 영역이 한 점에서 만나는 경우 꼭짓점 하나를 공동 참조하여 접촉 관계를 보존하세요. 임의로 선을 이어 이웃을 추가하지 마세요.
  두 영역 형식 예: {"type":"region_map","vertices":[{"id":"TL","x":0,"y":4},{"id":"TR","x":4,"y":4},{"id":"BR","x":4,"y":0},{"id":"BL","x":0,"y":0}],"regions":[{"id":"A","x":3,"y":3},{"id":"B","x":1,"y":1}],"boundaries":[{"id":"top","from":"TL","to":"TR","regions":["A"]},{"id":"right","from":"TR","to":"BR","regions":["A"]},{"id":"bottom","from":"BR","to":"BL","regions":["B"]},{"id":"left","from":"BL","to":"TL","regions":["B"]},{"id":"middle","from":"TL","to":"BR","regions":["A","B"],"controls":[{"x":1,"y":4},{"x":3,"y":0}]}]}
  controls는 생략하면 직선, 점 두 개를 넣으면 삼차 베지에 곡선의 제어점입니다. 외부 SVG나 경로 문자열은 쓰지 마세요. 각 영역의 경계는 하나의 닫힌 고리여야 하고, 곡선이 의도치 않게 교차하거나 영역이 겹치면 안 됩니다. 라벨은 해당 영역 안에 놓으세요. 최대 꼭짓점 64개·영역 16개·경계 96개입니다. 원본과 생성 문제에 도형 필수 표시와 해당 region_map을 모두 넣으세요. 색의 수만 바꿀 때는 같은 경계 그림을 유지해도 됩니다. 곡률은 개략적으로 바꿀 수 있지만 영역 수·경계 공유·점 접촉·구멍 유무를 임의로 바꾸지 마세요. 이웃 쌍을 원문 그림과 대조한 뒤 풀이에도 명시하세요. 경계 구조를 확정할 수 없거나 이 형식으로 표현할 수 없으면 추측하지 말고 먼저 알려 주세요. 앱의 형식 검사는 원문 그림이나 정답의 정확성을 보장하지 않습니다.
수학은 정의역·분모가 0이 되는 값·근호와 로그의 조건·해의 개수·조건을 동시에 만족하는 대상의 존재 여부를 다시 확인하고, 무연근·누락된 해가 없는지 풀이에 밝혀 주세요.
파일을 만들 수 있다면 같은 내용을 UTF-8의 worksheet.json으로 저장해 주세요.
${JSON.stringify({original_problem:"원본 문제 전체",subject:"과목",unit:"단원",problem_type:"문제 유형",concept:"핵심 개념",difficulty:"난이도",answer:"원본 정답",solution:"원본 풀이",warning:"",original_diagram_required:false,generated_questions:[{question:"생성 문제 전체",answer:"정답",solution:"간단한 풀이",diagram_required:false}]},null,2)}
위 예시의 도형 필수 여부 false는 도형이 없는 문제일 때만 유지하세요. 도형이 있으면 true로 바꾸고 original_diagram 및 각 diagram을 추가하세요.`;
}
export const exampleText=JSON.stringify({
  original_problem:"다음 방정식을 푸시오. 3x + 5 = 20",subject:"수학",unit:"일차방정식",problem_type:"일차방정식의 해",concept:"등식의 성질",difficulty:"기본",answer:"5",solution:"3x = 15이므로 x = 5입니다.",warning:"",
  generated_questions:[[4,7,6],[2,3,7],[5,4,4],[6,2,3],[3,8,8]].map(([a,b,x])=>({question:`다음 방정식을 푸시오. ${a}x + ${b} = ${a*x+b}`,answer:String(x),solution:`양변에서 ${b}만큼 빼면 ${a}x = ${a*x}입니다. 따라서 x = ${x}입니다.`})),
},null,2);
