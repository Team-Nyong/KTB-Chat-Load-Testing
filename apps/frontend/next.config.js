const isStaticExport = process.env.STATIC_EXPORT === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // 에러 처리 문제 해결을 위해 일시적으로 비활성화
  transpilePackages: ['@vapor-ui/core', '@vapor-ui/icons'],
  // STATIC_EXPORT=true 시 CDN 배포용 정적 export, 기본은 기존 standalone 출력
  output: isStaticExport ? 'export' : 'standalone',
  // monorepo에서 standalone 빌드 시 중첩 경로 방지 (정적 export 시 불필요)
  ...(isStaticExport ? {} : { outputFileTracingRoot: __dirname }),
  // 개발 환경에서의 에러 오버레이 설정
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right'
  },
  // 개발 환경에서만 더 자세한 에러 로깅
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      forceSwcTransforms: true
    }
  })
};

module.exports = nextConfig;
