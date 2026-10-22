export type StudyContext={grade?:string;scope?:string;methods?:string;mistake?:string;purpose?:""|"concept"|"accuracy"|"independent"};
export function studyInstructions(context?:StudyContext):string {
  if(!context)return "";
  const labels={grade:"학년",scope:"배운 범위",methods:"허용 풀이 방법",mistake:"원본에서 틀린 이유"};
  const fields=(Object.keys(labels) as (keyof typeof labels)[]).filter(k=>context[k]?.trim()).map(k=>`${labels[k]}: ${context[k]?.trim()}`);
  const purpose={concept:"개념 다시 익히기: hint에는 출발 개념만 짧게 제시하고 정답은 노출하지 마세요. solution에는 개념 설명과 단계별 근거를 충분히 쓰세요.",accuracy:"계산 실수 줄이기: hint에는 부호·괄호·계산 순서 또는 영어의 수 일치·부정·문맥 점검 중 해당 문제의 실수 지점만 적으세요. solution에는 실수하기 쉬운 단계와 마지막 확인 과정을 쓰세요.",independent:"혼자 풀 수 있는지 확인하기: hint는 빈 문자열로 두고 문제 본문에 힌트를 추가하지 마세요. solution에는 정답의 필수 근거를 간결하게 쓰세요."};
  if(context.purpose)fields.push(`연습 목적: ${purpose[context.purpose]}`);
  return fields.length?`\n[수업 조건 — 선택 입력]\n${fields.join("\n")}\n학년·배운 범위·허용 풀이 방법을 지키고 아직 배우지 않은 도구를 임의로 사용하지 마세요. 조건끼리 충돌하거나 풀이가 불가능하면 먼저 알려 주세요. hint는 선택 항목이며 본문·정답·풀이와 분리하세요.\n`:"";
}
