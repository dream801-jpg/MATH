import {tokenizeMatrices} from "./matrix";
import {splitMath,renderFormula} from "./math-display";

export function getDisplayWarnings(texts:string[]):string[] {
  const warnings=new Set<string>();
  for(const text of texts) {
    const pieces=splitMath(text);
    if(pieces.some(p=>p.tex&&renderFormula(p.tex,p.display)===null))
      warnings.add("조판하지 못한 수식이 있어 해당 부분을 원문으로 표시합니다. 수식 괄호와 명령을 확인하세요.");
    if(pieces.some(p=>!p.tex&&/\\(?:frac|sqrt|begin|int|sum)\b/.test(p.text)))
      warnings.add("LaTeX 수식을 $...$ 또는 $$...$$로 감싸 주세요.");
    if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))
      warnings.add("보이지 않는 제어문자가 있습니다. JSON의 역슬래시 표기가 잘못되었을 수 있으니 원문과 비교해 확인하세요.");
    if(tokenizeMatrices(text).some(token=>token.type==="text"&&token.text.includes("[[")))
      warnings.add("표시할 수 없는 행렬 표기가 있습니다. 각 행의 열 수·괄호·빈 성분과 최대 6행·6열 범위를 확인하세요.");
    if(/<\/?(?:svg|img|math|table|script|iframe)\b/i.test(text))
      warnings.add("그림·표를 그리는 HTML 코드가 있습니다. 현재 앱은 코드를 그림으로 실행하지 않고 글자로 보여줍니다.");
  }
  return [...warnings];
}
