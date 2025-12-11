/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // 에러 처리 문제 해결을 위해 일시적으로 비활성화
  transpilePackages: ['@vapor-ui/core', '@vapor-ui/icons'],
  // S3 + CloudFront 정적 배포를 위한 export 모드
  output: 'export',
  // SPA 라우팅을 위한 trailing slash
  trailingSlash: true,
  // 정적 export에서는 Next.js Image Optimization 사용 불가
  images: {
    unoptimized: true
  },
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
