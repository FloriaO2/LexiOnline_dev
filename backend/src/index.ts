/**
 * IMPORTANT:
 * ---------
 * Do not manually edit this file if you'd like to host your server on Colyseus Cloud
 *
 * If you're self-hosting (without Colyseus Cloud), you can manually
 * instantiate a Colyseus Server as documented here:
 *
 * See: https://docs.colyseus.io/server/api/#constructor-options
 */

import { listen } from "@colyseus/tools";
import app from "./app.config";
import { PrismaClient } from "@prisma/client";
import { CleanupScheduler } from "./cleanupScheduler";

const prisma = new PrismaClient();

async function main() {
  try {
    // 데이터베이스 연결 확인
    console.log("[Prisma] 데이터베이스 연결 시도 중...");
    console.log("[Prisma] DATABASE_URL 존재 여부:", !!process.env.PRISMA_DATABASE_URL);
    
    await prisma.$connect();
    console.log("✅ Prisma connected successfully.");
    
    // 연결 테스트 쿼리
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log("✅ 데이터베이스 연결 테스트 성공");
    } catch (testError) {
      console.error("❌ 데이터베이스 연결 테스트 실패:", testError);
    }
    
    // Express + Colyseus with explicit host binding
    const port = Number(process.env.PORT) || 2567;
    const host = '0.0.0.0'; // 명시적으로 0.0.0.0에 바인딩
    
    // listen 함수는 자동으로 WebSocket 업그레이드를 처리합니다
    // Railway의 리버스 프록시도 WebSocket을 자동으로 지원합니다
    const gameServer = await listen(app, port);
    console.log(`🚀 Colyseus server is listening on ${host}:${port}...`);
    
    // 빈 방 정리 스케줄러 시작
    const cleanupScheduler = new CleanupScheduler(gameServer);
    cleanupScheduler.start();
    
  } catch (error) {
    console.error("❌ Failed to connect Prisma:", error);
    process.exit(1);
  }
}

main();
