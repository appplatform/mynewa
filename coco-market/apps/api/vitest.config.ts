import { defineConfig } from 'vitest/config';
// 두 테스트 파일이 같은 테스트 DB를 비우고 쓰므로 순차 실행한다.
export default defineConfig({ test: { fileParallelism: false, testTimeout: 30_000, hookTimeout: 30_000 } });
