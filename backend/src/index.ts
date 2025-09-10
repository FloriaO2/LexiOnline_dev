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
    
    // Express + Colyseus
    const gameServer = await listen(app); // 이 app에는 Express가 탑재된 상태
    console.log("🚀 Colyseus server is listening...");
    
    // 빈 방 정리 스케줄러 시작
    const cleanupScheduler = new CleanupScheduler(gameServer);
    cleanupScheduler.start();
    
  } catch (error) {
    console.error("❌ Failed to connect Prisma:", error);
    process.exit(1);
  }
}

main();
