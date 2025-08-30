import { Client, Room } from "colyseus.js";

class ColyseusService {
  private client: Client;
  private room: Room | null = null;
  private isConnected: boolean = false;
  private roomInfo: { roomId: string; sessionId: string; nickname: string } | null = null;

  constructor() {
    this.client = new Client("ws://localhost:2567");
  }

  async connectToRoom(roomName?: string): Promise<Room> {
    try {
      if (roomName) {
        // 기존 방에 참가
        this.room = await this.client.join("my_room", { roomName });
      } else {
        // 새 방 생성 또는 참가
        this.room = await this.client.joinOrCreate("my_room");
      }

      this.isConnected = true;
      
      // 방 정보 저장
      this.saveRoomInfo();
      
      // 연결 상태 이벤트 리스너
      this.room.onLeave((code) => {
        console.log("방에서 나갔습니다:", code);
        this.isConnected = false;
        this.room = null;
        this.clearRoomInfo();
      });

      this.room.onError((code, message) => {
        console.error("방 연결 오류:", code, message);
        this.isConnected = false;
        this.clearRoomInfo();
      });

      return this.room;
    } catch (error) {
      console.error("방 연결 실패:", error);
      throw error;
    }
  }

  async createRoom(options: any = {}): Promise<Room> {
    try {
      this.room = await this.client.create("my_room", options);
      this.isConnected = true;
      
      // 방 정보 저장
      this.saveRoomInfo();
      
      // 연결 상태 이벤트 리스너
      this.room.onLeave((code) => {
        console.log("방에서 나갔습니다:", code);
        this.isConnected = false;
        this.room = null;
        this.clearRoomInfo();
      });

      this.room.onError((code, message) => {
        console.error("방 연결 오류:", code, message);
        this.isConnected = false;
        this.clearRoomInfo();
      });

      return this.room;
    } catch (error) {
      console.error("방 생성 실패:", error);
      throw error;
    }
  }

  async joinRoom(roomId: string, options: any = {}): Promise<Room> {
    try {
      // roomId가 실제 방 ID인지 확인하고 참가
      this.room = await this.client.joinById(roomId, options);
      this.isConnected = true;
      
      // 방 정보 저장
      this.saveRoomInfo();
      
      // 연결 상태 이벤트 리스너
      this.room.onLeave((code) => {
        console.log("방에서 나갔습니다:", code);
        this.isConnected = false;
        this.room = null;
        this.clearRoomInfo();
      });

      this.room.onError((code, message) => {
        console.error("방 연결 오류:", code, message);
        this.isConnected = false;
        this.clearRoomInfo();
      });

      return this.room;
    } catch (error) {
      console.error("방 참가 실패:", error);
      throw error;
    }
  }

  sendMessage(type: string, data: any) {
    if (this.room && this.isConnected) {
      this.room.send(type, data);
    } else {
      console.warn("방에 연결되지 않았습니다.");
    }
  }

  getRoom(): Room | null {
    return this.room;
  }

  isRoomConnected(): boolean {
    return this.isConnected && this.room !== null;
  }

  disconnect() {
    if (this.room) {
      this.room.leave();
      this.room = null;
      this.isConnected = false;
    }
    this.clearRoomInfo();
  }

  // 방 정보 저장
  private saveRoomInfo() {
    if (this.room) {
      this.roomInfo = {
        roomId: this.room.roomId,
        sessionId: this.room.sessionId,
        nickname: sessionStorage.getItem('current_nickname') || ''
      };
      sessionStorage.setItem('room_info', JSON.stringify(this.roomInfo));
      console.log('방 정보 저장됨:', this.roomInfo);
    }
  }

  // 방 정보 삭제
  private clearRoomInfo() {
    this.roomInfo = null;
    sessionStorage.removeItem('room_info');
  }

  // 저장된 방 정보 가져오기
  getSavedRoomInfo() {
    if (!this.roomInfo) {
      const saved = sessionStorage.getItem('room_info');
      if (saved) {
        this.roomInfo = JSON.parse(saved);
        console.log('저장된 방 정보 로드됨:', this.roomInfo);
      }
    }
    return this.roomInfo;
  }

  // 저장된 방에 재연결 시도
  async reconnectToSavedRoom(): Promise<Room | null> {
    const savedInfo = this.getSavedRoomInfo();
    if (!savedInfo) {
      return null;
    }

    try {
      console.log('저장된 방에 재연결 시도:', savedInfo.roomId);
      this.room = await this.client.joinById(savedInfo.roomId);
      this.isConnected = true;
      
      // 재연결 시 기존 닉네임 확인
      console.log('재연결 완료. 기존 닉네임 확인 중:', savedInfo.nickname);
      
      // 서버에 기존 닉네임 확인 요청
      this.room.send('checkNickname');
      
      // 닉네임 확인 응답 처리
      this.room.onMessage('nicknameConfirmed', (message) => {
        console.log('기존 닉네임 확인됨:', message.nickname);
        // 기존 닉네임이 있으면 저장된 정보 업데이트
        if (message.nickname && message.nickname !== '익명') {
          this.roomInfo = { ...this.roomInfo!, nickname: message.nickname };
          sessionStorage.setItem('room_info', JSON.stringify(this.roomInfo));
        }
      });
      
      // 연결 상태 이벤트 리스너 재설정
      this.room.onLeave((code) => {
        console.log("방에서 나갔습니다:", code);
        this.isConnected = false;
        this.room = null;
        this.clearRoomInfo();
      });

      this.room.onError((code, message) => {
        console.error("방 연결 오류:", code, message);
        this.isConnected = false;
        this.clearRoomInfo();
      });

      console.log('저장된 방 재연결 성공');
      return this.room;
    } catch (error) {
      console.error("저장된 방 재연결 실패:", error);
      
      // 방이 존재하지 않는 경우 (정상적인 상황)
      if (error instanceof Error && error.message && error.message.includes('not found')) {
        console.log('방이 이미 닫혔거나 존재하지 않습니다. 저장된 정보를 삭제합니다.');
      }
      
      this.clearRoomInfo();
      return null;
    }
  }
}

export default new ColyseusService();
