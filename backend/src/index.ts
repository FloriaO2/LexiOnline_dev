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
    await prisma.$connect();
    console.log("✅ Prisma connected successfully.");
    
    // Express + Colyseus with explicit host binding
    const port = Number(process.env.PORT) || 8080;
    const host = '0.0.0.0'; // 명시적으로 0.0.0.0에 바인딩
    
    // listen 함수 - 환경변수로 호스트 설정
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
