/** @type {import('next').NextConfig} */
const path = require('path');

// 환경변수로 빌드 모드 선택
// STATIC_EXPORT=true → S3 정적 호스팅용 (out/ 폴더 생성)
// STATIC_EXPORT 없음 → 서버 빌드용 (standalone)
const isStaticExport = process.env.STATIC_EXPORT === 'true';

const nextConfig = {
  reactStrictMode: false,
  transpilePackages: ['@vapor-ui/core', '@vapor-ui/icons'],

  // 빌드 모드에 따라 output 설정
  output: isStaticExport ? 'export' : 'standalone',

  // standalone 모드에서만 필요
  ...(isStaticExport ? {} : { outputFileTracingRoot: path.join(__dirname, '../../') }),


  // 정적 export 시 이미지 최적화 비활성화
  images: {
    unoptimized: isStaticExport,
  },

  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right'
  },

  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      forceSwcTransforms: true
    }
  })
};

console.log(`[Next.js Config] Build mode: ${isStaticExport ? 'Static Export (S3)' : 'Standalone (Server)'}`);

module.exports = nextConfig;
