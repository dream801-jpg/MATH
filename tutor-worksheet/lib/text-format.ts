// 일반 글자에 중복 기록된 줄바꿈만 복구한다. LaTeX 수식과 명령은 변경하지 않는다.
export function normalizeTextBreaks(text:string):string {
  const math=/\$\$[\s\S]*?\$\$|\$[^$\n]*?\$/g;
  const plain=(value:string)=>value.replace(/\r\n?/g,"\n").replace(/\\+(?:r\\+n|n|r)(?![a-zA-Z])/g,"\n");
  let result="",start=0;
  for(const match of text.matchAll(math)){
    result+=plain(text.slice(start,match.index))+match[0];start=match.index!+match[0].length;
  }
  return result+plain(text.slice(start));
}

export function printText(text:string,compact:boolean):string {
  const normalized=normalizeTextBreaks(text);
  if(!compact)return normalized;
  // 연속 빈 줄은 출력용 사본에서만 줄이고 문제 본문과 저장 데이터는 보존한다.
  return normalized.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g).map((part,i)=>i%2?part:part.replace(/\n[\t ]*\n+/g,"\n")).join("");
}
