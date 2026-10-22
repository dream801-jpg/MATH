export type MathToken = {type:"text";text:string}|{type:"matrix";rows:string[][];original:string};

function splitRow(source:string):string[]|null {
  const cells:string[]=[];const stack:string[]=[];let start=0;
  for(let i=0;i<source.length;i++) {
    const char=source[i];
    if(char==="("||char==="{")stack.push(char);
    else if(char===")"||char==="}") {
      if(stack.pop()!==(char===")"?"(":"{"))return null;
    } else if(char===","&&!stack.length) {cells.push(source.slice(start,i).trim());start=i+1;}
  }
  if(stack.length)return null;
  cells.push(source.slice(start).trim());return cells;
}

// 데이터는 실행하지 않고 쉼표와 대괄호만 해석한다. 불완전한 표기는 원문으로 남긴다.
export function tokenizeMatrices(text:string):MathToken[] {
  const pattern=/\[\s*\[[^\[\]]+\](?:\s*,\s*\[[^\[\]]+\])*\s*\]/g;
  const tokens:MathToken[]=[];let start=0;
  for(const match of text.matchAll(pattern)) {
    const original=match[0];const index=match.index;
    // 3차원 배열에서 안쪽 행렬만 임의로 분리해 표시하지 않는다.
    if(text.slice(0,index).trimEnd().endsWith("[")||text.slice(index+original.length).trimStart().startsWith("]"))continue;
    const parsed=[...original.matchAll(/\[([^\[\]]+)\]/g)].map(row=>splitRow(row[1]));
    if(parsed.some(row=>row===null))continue;
    const rows=parsed as string[][];
    const columns=rows[0]?.length||0;
    const valid=rows.length>=1&&rows.length<=6&&columns>=1&&columns<=6&&rows.every(row=>row.length===columns&&row.every(cell=>cell.length>0&&cell.length<=40&&!/[\r\n]/.test(cell)));
    if(!valid)continue;
    if(index>start)tokens.push({type:"text",text:text.slice(start,index)});
    tokens.push({type:"matrix",rows,original});start=index+original.length;
  }
  if(start<text.length)tokens.push({type:"text",text:text.slice(start)});
  return tokens;
}
