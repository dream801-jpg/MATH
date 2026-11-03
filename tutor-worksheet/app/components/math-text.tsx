import { Fragment } from "react";
import { tokenizeMatrices } from "@/lib/matrix";
import { renderFormula, splitMath } from "@/lib/math-display";
import {normalizeTextBreaks} from "@/lib/text-format";

// displayStyle: 분수를 글줄 크기로 줄이지 않고 시험지처럼 제 크기로 조판한다(보기·정답용).
function Formulas({text,displayStyle=false}:{text:string;displayStyle?:boolean}) {
  return <>{splitMath(text).map((piece,index)=>{
    if(!piece.tex)return piece.text;
    const html=renderFormula(displayStyle&&!piece.display?`\\displaystyle ${piece.tex}`:piece.tex,piece.display);
    return html?<span key={index} className={piece.display?"typeset-math display-math":"typeset-math"} dangerouslySetInnerHTML={{__html:html}}/>:<span key={index} className="math-fallback" title="수식 표기를 확인하세요. 원문을 표시합니다.">{piece.text}</span>;
  })}</>;
}

function Inline({text,displayStyle=false}:{text:string;displayStyle?:boolean}) {
  return <>{tokenizeMatrices(text).map((token,index)=>token.type==="text"?<Formulas key={index} text={token.text} displayStyle={displayStyle}/>:
    <span className="inline-matrix" role="math" aria-label={`${token.rows.length}행 ${token.rows[0].length}열 행렬: ${token.rows.map(row=>row.join(", ")).join("; ")}`} key={index}>
      <span className="matrix-grid" aria-hidden="true" style={{gridTemplateColumns:`repeat(${token.rows[0].length}, max-content)`}}>
        {token.rows.flatMap((row,r)=>row.map((cell,c)=><span className="matrix-cell" key={`${r}-${c}`}>{cell}</span>))}
      </span>
    </span>
  )}</>;
}

// "① … ② … ⑤ …" 처럼 보기만 있는 줄은 시험지처럼 같은 폭 칸에 나눠 놓는다.
const CHOICE_LINE=/^\s*①.*②/;
function Choices({line}:{line:string}) {
  const parts=line.trim().split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/).map(s=>s.trim()).filter(Boolean);
  // 수식을 뺀 글자가 긴 보기(영어 문장 등)는 한 줄에 하나씩.
  const long=parts.some(p=>p.replace(/\$[^$]*\$/g,"x").length>16);
  return <span className={`choices ${long?"is-long":""}`}>{parts.map((p,i)=><span className="choice" key={i}><Inline text={p} displayStyle/></span>)}</span>;
}

export function MathText({text,displayStyle=false}:{text:string;displayStyle?:boolean}) {
  const normalized=normalizeTextBreaks(text);
  const lines=normalized.split("\n");
  if(!lines.some(l=>CHOICE_LINE.test(l)))return <Inline text={normalized} displayStyle={displayStyle}/>;
  return <>{lines.map((line,i)=>{
    const isChoice=CHOICE_LINE.test(line);
    const breakBefore=i>0&&!isChoice&&!CHOICE_LINE.test(lines[i-1]);
    return <Fragment key={i}>{breakBefore&&"\n"}{isChoice?<Choices line={line}/>:<Inline text={line} displayStyle={displayStyle}/>}</Fragment>;
  })}</>;
}
