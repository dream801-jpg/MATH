import linear from "../examples/worksheet.json";
import matrix from "../examples/matrix-worksheet.json";
import integral from "../examples/inverse-integral-worksheet.json";
import chord from "../examples/circle-chord-worksheet.json";
import trigonometry from "../examples/trigonometric-graph-worksheet.json";
import triangle from "../examples/triangle-incenter-worksheet.json";

import absoluteIntegral from "../examples/absolute-integral-worksheet.json";

export const sampleWorksheets=[
  {id:"absolute-integral",title:"긴 문제 인쇄 예제",description:"절댓값 정적분 · 여백 조절",data:absoluteIntegral},
  {id:"linear",title:"일차방정식",description:"기본 사용법 연습",data:linear},
  {id:"matrix",title:"행렬",description:"행·열이 정렬된 수식",data:matrix},
  {id:"integral",title:"역함수와 적분",description:"적분·분수·지수 표시",data:integral},
  {id:"chord",title:"원과 현",description:"원·현·삼각형 도형",data:chord},
  {id:"trigonometry",title:"삼각함수 그래프",description:"코사인 곡선과 교점",data:trigonometry},
  {id:"triangle",title:"삼각형과 외접원",description:"내심·각의 이등분선",data:triangle},
];
