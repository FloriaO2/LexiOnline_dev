// src/rooms/LobbyRoom.ts
import { Room, Client } from "@colyseus/core";

export class LobbyRoom extends Room {
  maxClients = 100; // 로비는 많은 사용자가 접속할 수 있음

  onCreate(options: any) {
    // 단순한 로비 방 - 상태 관리 없음
  }

  onJoin(client: Client, options: any) {
    // 클라이언트 입장
  }

  onLeave(client: Client, consented: boolean) {
    // 클라이언트 퇴장
  }

  onDispose() {
    // 방 삭제
  }

  // 방 목록 업데이트 알림을 모든 로비 클라이언트에게 전송
  notifyRoomListUpdate(type: 'roomCreated' | 'roomDeleted' | 'roomUpdated', roomData?: any) {
    const message = {
      type,
      roomData,
      timestamp: Date.now()
    };
    
    this.broadcast("roomListUpdate", message);
  }
}
