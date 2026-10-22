import katex from "katex";

// 정답 계산이 아니라 이전 파일의 명확한 표기만 조판한다. 모호한 식은 원문을 유지한다.
export function plainToTex(source:string):string {
  let i=0;
  const symbols:Record<string,string>={"π":"\\pi ","θ":"\\theta ","∞":"\\infty ","≤":"\\le ","≥":"\\ge ","×":"\\times ","²":"^{2}","³":"^{3}","′":"^{\\prime}"};
  function group():string {
    if(source[i]!=="(")throw Error("괄호 필요");
    const start=++i;let depth=1;
    while(i<source.length&&depth){if(source[i]==="(")depth++;if(source[i]===")")depth--;i++;}
    if(depth)throw Error("괄호 불일치");
    return plainToTex(source.slice(start,i-1));
  }
  function atom():string {
    while(source[i]===" ")i++;
    if(i>=source.length)throw Error("항 누락");
    if(source[i]==="(")return `\\left(${group()}\\right)`;
    if(source.startsWith("∫[",i)) {
      i+=2;const start=i;let depth=0,comma=-1;
      while(i<source.length){const c=source[i];if(c==="(")depth++;if(c===")")depth--;if(c===","&&depth===0)comma=i;if(c==="]"&&depth===0)break;i++;}
      if(source[i]!=="]"||comma<0)throw Error("적분 구간 오류");
      const lower=plainToTex(source.slice(start,comma)),upper=plainToTex(source.slice(comma+1,i++));
      return `\\int_{${lower}}^{${upper}}`;
    }
    if(source[i]==="√"){i++;return `\\sqrt{${source[i]==="("?group():atom()}}`;}
    const fn=/^(cos|sin|tan|ln|log)\b/.exec(source.slice(i));
    if(fn){i+=fn[0].length;return `\\${fn[0]} `;}
    const num=/^\d+(?:\.\d+)?/.exec(source.slice(i));
    if(num){i+=num[0].length;return num[0];}
    const ch=source[i++];
    if(/[\\{}$\[\]]/.test(ch))throw Error("지원 범위 밖");
    return symbols[ch]??ch;
  }
  const parts:string[]=[];
  while(i<source.length){
    if(/\s/.test(source[i])){i++;continue;}
    if(source[i]==="/"||source[i]==="^"){
      const op=source[i++],prev=parts.pop();if(!prev)throw Error("왼쪽 항 누락");
      const next=source[i]==="("?group():atom();
      parts.push(op==="/"?`\\frac{${prev}}{${next}}`:`${prev}^{${next}}`);
    }else parts.push(atom());
  }
  return parts.join(" ");
}

export type MathPiece={text:string;tex?:string;display?:boolean};
export function splitMath(text:string):MathPiece[] {
  const pieces:MathPiece[]=[];
  // 달러 구분 수식을 우선 처리하여 행렬이나 일반 표기 변환과 섞이지 않게 한다.
  const explicit=/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  function legacy(value:string){
    // 한글 문장은 건드리지 않고 수학 문자로만 이루어진 구간을 대상으로 한다.
    const runs=/[A-Za-z0-9πθ∞∫√²³′≤≥×+−\-*/^=(),.\[\] \t]+/g;
    let start=0;
    for(const match of value.matchAll(runs)){
      if(!/[∫√^]|\d\s*\/\s*\d/.test(match[0]))continue;
      if(match.index!>start)pieces.push({text:value.slice(start,match.index)});
      try{pieces.push({text:match[0],tex:plainToTex(match[0].trim())});}catch{pieces.push({text:match[0]});}
      start=match.index!+match[0].length;
    }
    if(start<value.length)pieces.push({text:value.slice(start)});
  }
  let start=0;
  for(const match of text.matchAll(explicit)){
    legacy(text.slice(start,match.index));
    pieces.push({text:match[0],tex:match[1]??match[2],display:match[1]!==undefined});
    start=match.index!+match[0].length;
  }
  legacy(text.slice(start));return pieces;
}

export function renderFormula(tex:string,display=false):string|null {
  if(/\\(?:includegraphics|href|url|html\w*|def|gdef|edef|xdef|newcommand|renewcommand)\b/i.test(tex))return null;
  try{return katex.renderToString(tex.includes("\\int")?`\\displaystyle ${tex}`:tex,{displayMode:display,throwOnError:true,trust:false,strict:"error",maxExpand:200,maxSize:20,output:"htmlAndMathml"});}
  catch{return null;}
}
