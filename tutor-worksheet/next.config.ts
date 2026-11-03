import type { NextConfig } from "next";
// GitHub Pages(dream801-jpg.github.io/MATH/dasi/)용 빌드는 PAGES_BASE_PATH=/MATH/dasi 로 하위 경로를 붙인다.
// 값이 없으면 기존처럼 사이트 맨 위(/)에서 동작한다.
const basePath=process.env.PAGES_BASE_PATH||"";
const config: NextConfig = { output:"export", poweredByHeader: false, devIndicators: false, basePath, trailingSlash: !!basePath };
export default config;
