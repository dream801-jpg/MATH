// 빨간 색연필 채점 표시. 손으로 그린 듯 끝이 겹치는 동그라미·빗금·별.
// 모두 장식용이라 aria-hidden 이고, 뜻은 옆 글자(선택됨·오답)가 전한다.
type MarkProps={className?:string;animate?:boolean};

export function PencilCircle({className="",animate=true}:MarkProps) {
  return <svg className={`pencil-mark pencil-circle ${animate?"is-drawn":""} ${className}`} viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path pathLength={1} d="M76 8C57 0 21 2 9 19C-1 33 13 58 47 59C81 60 99 44 93 23C89 10 71 3 50 6" />
  </svg>;
}

export function PencilSlash({className=""}:{className?:string}) {
  return <svg className={`pencil-mark pencil-slash ${className}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path pathLength={1} d="M12 88C34 66 62 36 90 10" />
  </svg>;
}

export function PencilStar({className=""}:{className?:string}) {
  return <svg className={`pencil-mark pencil-star ${className}`} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <path pathLength={1} d="M20 3L24.6 15.2L37 15.8L27.4 23.6L30.8 36L20 28.8L9.6 36.4L12.8 23.8L3 16L15.6 15Z" />
  </svg>;
}
