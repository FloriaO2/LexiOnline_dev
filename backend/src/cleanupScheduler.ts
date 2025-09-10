import { matchMaker } from "colyseus";

export class CleanupScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private gameServer: any;

  constructor(gameServer: any) {
    this.gameServer = gameServer;
  }

  start() {
    console.log("🧹 빈 방 정리 스케줄러를 시작합니다...");
    
    // 5분마다 빈 방 정리
    this.intervalId = setInterval(async () => {
      await this.cleanupEmptyRooms();
    }, 5 * 60 * 1000); // 5분마다 실행
    
    console.log("✅ 빈 방 정리 스케줄러가 시작되었습니다. (5분 간격)");
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("🛑 빈 방 정리 스케줄러가 중지되었습니다.");
    }
  }

  private async cleanupEmptyRooms() {
    try {
      if (!this.gameServer) {
        console.log("Game server not available for cleanup");
        return;
      }

      console.log("🧹 빈 방 정리 작업 시작...");
      
      // 모든 방 조회
      let rooms: any[] = [];
      try {
        if (matchMaker && matchMaker.query) {
          rooms = await matchMaker.query({});
        } else if (this.gameServer.rooms) {
          rooms = Object.values(this.gameServer.rooms);
        }
      } catch (error) {
        console.error("방 조회 중 오류:", error);
        return;
      }

      let cleanedCount = 0;
      
      // 빈 방 찾아서 삭제
      for (const room of rooms) {
        try {
          // 클라이언트가 0명인 방 찾기
          if (room.clients === 0) {
            console.log(`🗑️ 빈 방 발견: ${room.roomId} (${room.name})`);
            
            // 방 삭제 - matchMaker.disconnectAll 사용
            try {
              await matchMaker.disconnectAll(room.roomId);
              cleanedCount++;
              console.log(`✅ 빈 방 삭제 완료: ${room.roomId}`);
            } catch (disconnectError) {
              console.error(`방 ${room.roomId} 삭제 중 오류:`, disconnectError);
            }
          }
        } catch (error) {
          console.error(`방 ${room.roomId} 처리 중 오류:`, error);
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 빈 방 정리 완료: ${cleanedCount}개 방 삭제`);
      } else {
        console.log("🧹 정리할 빈 방이 없습니다.");
      }
      
    } catch (error) {
      console.error("빈 방 정리 중 오류:", error);
    }
  }
}
