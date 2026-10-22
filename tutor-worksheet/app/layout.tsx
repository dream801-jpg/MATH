import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
export const metadata:Metadata={title:"다시풀기 · 나의 과외 문제지",description:"틀린 문제 한 장에서 시작하는 유사문제 연습"};
export default function Layout({children}:{children:React.ReactNode}) {
  return <html lang="ko"><body>{children}</body></html>;
}
