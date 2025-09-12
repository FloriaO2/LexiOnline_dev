import { Client, Room } from "colyseus.js";

class ColyseusService {
  private client: Client;
  private room: Room | null = null;
  private lobbyRoom: Room | null = null;
  private isConnected: boolean = false;
  private isLobbyConnectedFlag: boolean = false;
  private roomInfo: { roomId: string; sessionId: string; nickname: string } | null = null;

  constructor() {
    // 배포 환경 감지 및 URL 설정
    const isProduction = process.env.NODE_ENV === 'production';
    const apiUrl = process.env.REACT_APP_API_URL || 
      (isProduction ? 'https://lexionline-backend.fly.dev' : 'http://localhost:2567');
    const serverUrl = apiUrl.replace(/^http/, 'ws');
    this.client = new Client(serverUrl);
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
      
      // Colyseus playground 메시지 타입 핸들러 (콘솔 오류 방지)
      this.room.onMessage('__playground_message_types', () => {
        // 개발자 도구 메시지 무시
      });
      
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
      
      // Colyseus playground 메시지 타입 핸들러 (콘솔 오류 방지)
      this.room.onMessage('__playground_message_types', () => {
        // 개발자 도구 메시지 무시
      });
      
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
      // options에서 requirePassword가 명시적으로 설정되지 않은 경우에만 false로 설정
      const joinOptions = { ...options };
      if (joinOptions.requirePassword === undefined) {
        joinOptions.requirePassword = false; // 기본값은 false (방 코드로 입장하는 경우)
      }
      this.room = await this.client.joinById(roomId, joinOptions);
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

  // 공개방 목록 조회
  async getPublicRooms(): Promise<any[]> {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      const apiUrl = process.env.REACT_APP_API_URL || 
        (isProduction ? 'https://lexionline-backend.fly.dev' : 'http://localhost:2567');
      
      const response = await fetch(`${apiUrl}/api/rooms`);
      if (!response.ok) {
        throw new Error('Failed to fetch public rooms');
      }
      
      const data = await response.json();
      return data.rooms || [];
    } catch (error) {
      console.error('공개방 목록 조회 실패:', error);
      throw error;
    }
  }

  // 로비 방에 연결하여 실시간 방 목록 업데이트 수신
  async connectToLobby(): Promise<Room> {
    try {
      console.log('[DEBUG] connectToLobby 호출됨');
      
      // 이미 로비 방에 연결되어 있다면 기존 연결 반환
      if (this.lobbyRoom && this.isLobbyConnectedFlag) {
        console.log('[DEBUG] 이미 로비 방에 연결되어 있음, 기존 연결 반환');
        return this.lobbyRoom;
      }
      
      console.log('[DEBUG] 로비 방 생성/참가 시도 중...');
      this.lobbyRoom = await this.client.joinOrCreate("lobby_room");
      this.isLobbyConnectedFlag = true;
      console.log('[DEBUG] 로비 방 연결 완료, sessionId:', this.lobbyRoom.sessionId);
      
      // Colyseus playground 메시지 타입 핸들러 (콘솔 오류 방지)
      this.lobbyRoom.onMessage('__playground_message_types', () => {
        // 개발자 도구 메시지 무시
      });
      
      // 연결 상태 이벤트 리스너
      this.lobbyRoom.onLeave((code) => {
        console.log('[DEBUG] 로비 방 연결 해제됨, code:', code);
        this.isLobbyConnectedFlag = false;
        this.lobbyRoom = null;
        
        // 비정상 종료인 경우 재연결 시도
        if (code === 1006 || code === 1000) {
          console.log('[DEBUG] 로비 방 재연결 시도 중...');
          setTimeout(() => {
            this.connectToLobby().catch(error => {
              console.error("로비 방 재연결 실패:", error);
            });
          }, 3000);
        }
      });

      this.lobbyRoom.onError((code, message) => {
        console.error("로비 방 연결 오류:", code, message);
        this.isLobbyConnectedFlag = false;
        this.lobbyRoom = null;
        
        // 오류 발생 시 재연결 시도
        setTimeout(() => {
          this.connectToLobby().catch(error => {
            console.error("로비 방 오류 후 재연결 실패:", error);
          });
        }, 5000);
      });

      return this.lobbyRoom;
    } catch (error) {
      console.error("로비 방 연결 실패:", error);
      this.isLobbyConnectedFlag = false;
      this.lobbyRoom = null;
      throw error;
    }
  }

  // 로비 방 연결 해제
  disconnectLobby() {
    if (this.lobbyRoom) {
      this.lobbyRoom.leave();
      this.lobbyRoom = null;
      this.isLobbyConnectedFlag = false;
    }
  }

  // 로비 방 인스턴스 반환
  getLobbyRoom(): Room | null {
    return this.lobbyRoom;
  }

  // 로비 방 연결 상태 반환
  isLobbyConnected(): boolean {
    return this.isLobbyConnectedFlag && this.lobbyRoom !== null;
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
