import { tokenizeMatrices } from "@/lib/matrix";
import { renderFormula, splitMath } from "@/lib/math-display";
import {normalizeTextBreaks} from "@/lib/text-format";

function Formulas({text}:{text:string}) {
  return <>{splitMath(text).map((piece,index)=>{
    if(!piece.tex)return piece.text;
    const html=renderFormula(piece.tex,piece.display);
    return html?<span key={index} className={piece.display?"typeset-math display-math":"typeset-math"} dangerouslySetInnerHTML={{__html:html}}/>:<span key={index} className="math-fallback" title="수식 표기를 확인하세요. 원문을 표시합니다.">{piece.text}</span>;
  })}</>;
}

export function MathText({text}:{text:string}) {
  return <>{tokenizeMatrices(normalizeTextBreaks(text)).map((token,index)=>token.type==="text"?<Formulas key={index} text={token.text}/>:
    <span className="inline-matrix" role="math" aria-label={`${token.rows.length}행 ${token.rows[0].length}열 행렬: ${token.rows.map(row=>row.join(", ")).join("; ")}`} key={index}>
      <span className="matrix-grid" aria-hidden="true" style={{gridTemplateColumns:`repeat(${token.rows[0].length}, max-content)`}}>
        {token.rows.flatMap((row,r)=>row.map((cell,c)=><span className="matrix-cell" key={`${r}-${c}`}>{cell}</span>))}
      </span>
    </span>
  )}</>;
}
