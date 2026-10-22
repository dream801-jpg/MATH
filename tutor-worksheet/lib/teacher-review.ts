import type {Question} from "./schema";

export const NO_SOLUTION="풀이 없음 — 이 문제에는 해설이 제공되지 않았습니다.";
export function solutionMissing(text:string):boolean {
  return !text.trim()||/^(풀이가 없습니다|풀이 없음|해설 없음|해설이 없습니다)/.test(text.trim());
}
export function canSelect(q:Question,diagramConfirmed:boolean,missingAllowed:boolean):boolean {
  return q.verification!=="failed"&&(!q.diagram_review_required||diagramConfirmed)&&(!q.solution_missing||missingAllowed);
}
