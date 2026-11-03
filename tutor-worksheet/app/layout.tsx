import type { Metadata, Viewport } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
export const metadata:Metadata={title:"다시풀기 · 나의 과외 문제지",description:"틀린 문제 한 장에서 시작하는 유사문제 연습"};
export const viewport:Viewport={themeColor:"#18306E"};
// 화면 글꼴 Pretendard, 문제 본문 Noto Serif KR(시험지 명조), 채점 손글씨 Nanum Pen Script.
export default function Layout({children}:{children:React.ReactNode}) {
  return <html lang="ko">
    <head>
      <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin=""/>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"/>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&family=Noto+Serif+KR:wght@400;600;700&display=swap"/>
    </head>
    <body>{children}</body>
  </html>;
}
