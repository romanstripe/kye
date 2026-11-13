import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'ring-on-it',
  permissions: [],
  webBundleDir: 'dist',
  webView: { allowsInlineMediaPlayback: true },   // iOS 웹뷰가 카메라 영상을 전체화면 플레이어로 띄우지 않게
});
