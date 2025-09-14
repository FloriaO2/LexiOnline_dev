// src/rooms/MyRoom.ts
import { Room, Client } from "@colyseus/core";
import { ArraySchema } from "@colyseus/schema";
import { MyRoomState } from "./schema/MyRoomState";
import { PlayerState } from "./schema/PlayerState";
import { createShuffledDeck } from "../gameLogic/createShuffledDeck";
import { dealCards } from "../gameLogic/dealCards";
import { findPlayerWithCloud3 } from "../gameLogic/findPlayerWithCloud3";
import { calculateRoundScores, calculateRoundScoreMatrix } from "../gameLogic/scoreCalculator";
import { MADE_NONE } from "../gameLogic/cardEvaluator";
import prisma from "../../prisma/client";
import jwt, { JwtPayload } from "jsonwebtoken"
import {
  handleSubmit,
  handlePass,
  handleReady,
  handleEasyMode,
  handleSortOrder,
  IMyRoom,
} from "../roomLogic/messageHandlers";
import { calculateRanks } from "../gameLogic/calculateRanks";
import { calculateRatings } from "../gameLogic/calculateRatings";
import { DEFAULT_RATING_MU, DEFAULT_RATING_SIGMA } from "../constants/rating";
import { matchMaker } from "colyseus";

export class MyRoom extends Room<MyRoomState> implements IMyRoom {
  maxClients = 5;
  state = new MyRoomState();
  private finalGameResult: any = null;
  private turnTimer: NodeJS.Timeout | null = null; // 타임어택 타이머
  private gameCompleted: boolean = false; // 게임 완료 상태 추적
  
  // 방이 비어있을 때 자동 삭제 시간 (30분)
  autoDispose = false;

  maxNumberMap: Record<number, number> = { 2: 7, 3: 9, 4: 13, 5: 15 };

  // LobbyRoom에 방 목록 업데이트 알림 전송
  private async notifyLobbyRoomListUpdate(type: 'roomCreated' | 'roomDeleted' | 'roomUpdated', roomData?: any) {
    try {
      console.log(`[DEBUG] 로비 방 알림 전송 시도: type=${type}, roomData=`, roomData);
      
      // LobbyRoom 찾기
      const lobbyRooms = await matchMaker.query({ name: 'lobby_room' });
      console.log(`[DEBUG] 찾은 로비 방 수: ${lobbyRooms.length}`);
      
      if (lobbyRooms.length === 0) {
        console.log(`[DEBUG] 로비 방이 없어서 알림 전송 건너뜀`);
        return; // 로비 방이 없으면 무시
      }
      
      // 모든 로비 방에 알림 전송
      for (const lobbyRoom of lobbyRooms) {
        try {
          console.log(`[DEBUG] 로비 방 ${lobbyRoom.roomId}에 알림 전송 중...`);
          await (matchMaker as any).remoteRoomCall(lobbyRoom.roomId, 'notifyRoomListUpdate', [type, roomData]);
          console.log(`[DEBUG] 로비 방 ${lobbyRoom.roomId}에 알림 전송 성공`);
        } catch (error) {
          console.error(`[DEBUG] 로비 방 ${lobbyRoom.roomId}에 알림 전송 실패:`, error);
          // 알림 전송 실패 시 무시 (로비 방이 없을 수 있음)
        }
      }
    } catch (error) {
      console.error(`[DEBUG] 로비 방 알림 전송 전체 실패:`, error);
      // 전체 알림 전송 실패 시 무시
    }
  }

  onCreate(options: any) {
    
    // 방 생성 옵션에서 방 타입과 비밀번호 설정
    if (options.roomType) {
      this.state.roomType = options.roomType;
    }
    if (options.roomPassword) {
      this.state.roomPassword = options.roomPassword;
    }
    if (options.roomTitle) {
      this.state.roomTitle = options.roomTitle;
    }
    
    // 방 메타데이터 설정 (공개방 목록 조회용)
    const metadata = {
      roomType: this.state.roomType,
      roomTitle: this.state.roomTitle,
      roomPassword: this.state.roomType === 'private' ? '***' : '', // 비밀번호는 마스킹
      createdAt: new Date().toISOString()
    };
    
    this.setMetadata(metadata);
    
    // 방 생성 시에는 로비 알림을 보내지 않음 (onJoin에서 처리)
    
    this.onMessage("changeRounds", (client, data) => {
      if (client.sessionId !== this.state.host) {
        client.send("changeRejected", { reason: "Only the host can change rounds." });
        return;
      }
      const newRounds = data.rounds;
      if (typeof newRounds === "number" && newRounds > 0) {
        this.state.totalRounds = newRounds;
        // 모든 클라이언트에게 라운드 수 변경 알림
        this.broadcast("totalRoundsUpdated", { totalRounds: newRounds });
      } else {
        client.send("changeRejected", { reason: "Invalid round count." });
      }
    });

    this.onMessage("changeBlindMode", (client, data) => {
      if (client.sessionId !== this.state.host) {
        client.send("changeRejected", { reason: "Only the host can change game mode." });
        return;
      }
      const newBlindMode = data.blindMode;
      if (typeof newBlindMode === "boolean") {
        this.state.blindMode = newBlindMode;
        // 모든 클라이언트에게 블라인드 모드 변경 알림
        this.broadcast("blindModeChanged", { blindMode: newBlindMode });
      } else {
        client.send("changeRejected", { reason: "Invalid blind mode value." });
      }
    });

    this.onMessage("changeTimeAttackMode", (client, data) => {
      if (client.sessionId !== this.state.host) {
        client.send("changeRejected", { reason: "Only the host can change game mode." });
        return;
      }
      const newTimeAttackMode = data.timeAttackMode;
      if (typeof newTimeAttackMode === "boolean") {
        this.state.timeAttackMode = newTimeAttackMode;
        // 모든 클라이언트에게 타임어택 모드 변경 알림
        this.broadcast("timeAttackModeChanged", { timeAttackMode: newTimeAttackMode });
      } else {
        client.send("changeRejected", { reason: "Invalid time attack mode value." });
      }
    });

    this.onMessage("changeTimeLimit", (client, data) => {
      if (client.sessionId !== this.state.host) {
        client.send("changeRejected", { reason: "Only the host can change time limit." });
        return;
      }
      const newTimeLimit = data.timeLimit;
      if (typeof newTimeLimit === "number" && [10, 20, 30, 40].includes(newTimeLimit)) {
        this.state.timeLimit = newTimeLimit;
        // 모든 클라이언트에게 시간 제한 변경 알림
        this.broadcast("timeLimitChanged", { timeLimit: newTimeLimit });
      } else {
        client.send("changeRejected", { reason: "Invalid time limit value. Must be 10, 20, 30, or 40 seconds." });
      }
    });

    // 메시지 핸들러 분리한 함수 사용
    this.onMessage("submit", (client, data) => handleSubmit(this, client, data));
    this.onMessage("pass", (client) => handlePass(this, client));
    this.onMessage("ready", (client, data) => handleReady(this, client, data));
    this.onMessage("easyMode", (client, data) => handleEasyMode(this, client, data));
    this.onMessage("sortOrder", (client, data) => handleSortOrder(this, client, data));
    
    // ------------------------------------------------------------------- 프론트엔드 관련 추가

    // 프론트엔드 연결을 위한 추가 메시지 핸들러
    this.onMessage("setNickname", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !data.nickname) {
        client.send("nicknameRejected", { reason: "Invalid player or nickname" });
        return;
      }

      const nickname = data.nickname.trim();
      if (nickname.length === 0) {
        client.send("nicknameRejected", { reason: "Nickname cannot be empty" });
        return;
      }

      // 중복 닉네임 체크 (자신의 기존 닉네임은 제외)
      const existingPlayer = Array.from(this.state.players.values()).find(p => 
        p.nickname === nickname && p.sessionId !== client.sessionId
      );

      if (existingPlayer) {
        client.send("nicknameRejected", { 
          reason: "Nickname already exists in this room",
          existingNickname: nickname
        });
        return;
      }

      // 닉네임 설정
      player.nickname = nickname;
      this.broadcast("nicknameUpdate", {
        playerId: client.sessionId,
        nickname: nickname
      });
      
      console.log(`플레이어 ${client.sessionId}의 닉네임이 "${nickname}"으로 설정됨`);
    });

    // 재연결 시 기존 닉네임 확인
    this.onMessage("checkNickname", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.nickname && player.nickname !== '') {
        console.log(`재연결된 플레이어 ${client.sessionId}의 기존 닉네임: ${player.nickname}`);
        client.send("nicknameConfirmed", { nickname: player.nickname });
      }
    });

    // ------------------------------------------------------------------- 프론트엔드 관련 추가
    // get 관련 함수 추가

    // 게임 화면 진입 시 플레이어 정보 요청
    this.onMessage("requestPlayerInfo", (client) => {
      console.log(`플레이어 ${client.sessionId}가 플레이어 정보를 요청함`);
      console.log(`[DEBUG] 현재 게임 상태: round=${this.state.round}, isGameStarted=${this.state.round > 0}`);
      
      // 모든 플레이어 정보 전송
      const allPlayers = Array.from(this.state.players.entries()).map(([id, p]) => ({
        sessionId: id,
        nickname: p.nickname || '익명',
        score: p.score || 0,
        remainingTiles: p.hand ? p.hand.length : 0,
        isCurrentPlayer: id === client.sessionId
      }));
      
      // 현재 플레이어의 손패 정보도 포함
      const myPlayer = this.state.players.get(client.sessionId);
      const myHand = myPlayer && myPlayer.hand ? Array.from(myPlayer.hand) : [];
      
      // 정렬된 손패 순서가 있으면 사용, 없으면 원본 순서 사용
      const sortedHand = myPlayer && myPlayer.sortedHand.length > 0 
        ? Array.from(myPlayer.sortedHand)
        : myHand;
      
      console.log(`[DEBUG] 플레이어 손패: ${myHand.join(', ')}`);
      console.log(`[DEBUG] 정렬된 손패: ${sortedHand.join(', ')}`);
      console.log(`[DEBUG] sortedHand 길이: ${myPlayer?.sortedHand.length || 0}`);
      
      client.send("playerInfoResponse", {
        players: allPlayers,
        playerOrder: this.state.playerOrder.slice(),
        isGameStarted: this.state.round > 0,
        myHand: sortedHand, // 정렬된 순서로 전송
        maxNumber: this.state.maxNumber,
        round: this.state.round,
        totalRounds: this.state.totalRounds,
        blindMode: this.state.blindMode,
        myEasyMode: myPlayer?.easyMode || false // 개인 easyMode 설정 전송
      });
    });

    // 다음 라운드 시작 요청
    this.onMessage("startNextRound", (client) => {
      console.log(`플레이어 ${client.sessionId}가 다음 라운드 시작을 요청함`);
      
      // 현재 라운드가 마지막 라운드인지 확인
      if (this.state.round >= this.state.totalRounds) {
        client.send("nextRoundRejected", { reason: "이미 마지막 라운드입니다." });
        return;
      }
      
      // 다음 라운드로 진행
      this.startRound();
    });

    // 플레이어가 다음 라운드 준비 완료 신호
    this.onMessage("readyForNextRound", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.readyForNextRound = true;
        console.log(`플레이어 ${client.sessionId}가 다음 라운드 준비 완료`);
        
        // 모든 플레이어에게 준비 상태 업데이트 알림
        this.broadcast("readyForNextRound", {
          playerId: client.sessionId,
          ready: true
        });
        
        // 모든 플레이어가 준비되었는지 확인
        const allReady = Array.from(this.state.players.values()).every(p => p.readyForNextRound);
        if (allReady) {
          console.log("모든 플레이어가 다음 라운드 준비 완료");
          this.broadcast("allPlayersReadyForNextRound");
          // 다음 라운드 시작
          this.startRound();
        }
      }
    });

    this.onMessage("playAgain", (client) => {
      console.log(`[DEBUG] playAgain 요청: ${client.sessionId}`);
      this.resetGameState();
      this.broadcast("gameReset", {});
    });

    // 라운드 넘기기 대기창 용도
    // 현재 준비 상태 요청
    this.onMessage("requestReadyStatus", (client) => {
      console.log(`플레이어 ${client.sessionId}가 준비 상태를 요청함`);
      
      // 현재 준비된 플레이어들의 목록 전송
      const readyPlayerIds = Array.from(this.state.players.entries())
        .filter(([id, player]) => player.readyForNextRound)
        .map(([id, player]) => id);
      
      client.send("readyStatusResponse", {
        readyPlayers: readyPlayerIds,
        totalPlayers: this.state.players.size
      });
    });

    this.onMessage("requestFinalResult", (client) => {
      if (this.finalGameResult) {
        console.log(`[DEBUG] 플레이어 ${client.sessionId}에게 최종 결과를 전송합니다.`);
        client.send("finalResult", this.finalGameResult.finalScores);
      } else {
        console.log(`[WARN] 플레이어 ${client.sessionId}가 최종 결과를 요청했지만, 아직 준비되지 않았습니다.`);
        client.send("finalResultNotReady");
      }
    });

    // ------------------------------------------------------------------- 프론트엔드 관련 추가 끝

    this.onMessage("start", (client, data) => {
      console.log(`[DEBUG] start 메시지 수신: ${client.sessionId}`);
      
      if (client.sessionId !== this.state.host) {
        console.log(`[DEBUG] 호스트가 아님: ${client.sessionId} vs ${this.state.host}`);
        client.send("startRejected", { reason: "Only the host can start the game." });
        return;
      }

      if (this.state.players.size < 2) {
        console.log(`[DEBUG] 플레이어 수 부족: ${this.state.players.size}`);
        client.send("startRejected", { reason: "Not enough players." });
        return;
      }

      for(const [sessionId, player] of this.state.players){
        if(!player.ready){
          console.log(`[DEBUG] 준비되지 않은 플레이어: ${sessionId}`);
          client.send("startRejected", { reason: "There exists some players who are not ready. " });
          return;
        }
      }

      console.log(`[DEBUG] 게임 시작 조건 만족, startGame() 호출`);
      this.startGame();
      console.log(`[DEBUG] startRound() 호출`);
      this.startRound();
      console.log(`[DEBUG] gameStarted 브로드캐스트`);
      this.broadcast("gameStarted", { totalRounds: this.state.totalRounds, easyMode: this.state.easyMode });
    });
  }

  async onJoin(client: Client, options: any) {
    console.log(`[DEBUG] onJoin 호출됨 - 방 타입: ${this.state.roomType}, options:`, JSON.stringify(options, null, 2));
    
    // 구글 로그인 사용자만 접속 가능 (authToken 필수)
    if (!options.authToken) {
      throw new Error("구글 로그인이 필요합니다.");
    }
    
    if (this.state.round > 0) {
      throw new Error("게임이 이미 시작되었습니다.");
    }

    // 비밀방인 경우 비밀번호 검증
    if (this.state.roomType === "private") {
      console.log(`[DEBUG] ===== 비밀방 입장 시도 =====`);
      console.log(`[DEBUG] 방 ID: ${this.roomId}`);
      console.log(`[DEBUG] 방 타입: ${this.state.roomType}`);
      console.log(`[DEBUG] 저장된 비밀번호: "${this.state.roomPassword}" (길이: ${this.state.roomPassword.length})`);
      console.log(`[DEBUG] requirePassword: ${options.requirePassword} (타입: ${typeof options.requirePassword})`);
      console.log(`[DEBUG] 제공된 비밀번호: "${options.roomPassword}" (길이: ${options.roomPassword ? options.roomPassword.length : 0})`);
      
      // requirePassword가 명시적으로 false인 경우에만 비밀번호 검증 우회
      if (options.requirePassword === false) {
        console.log(`[DEBUG] requirePassword가 false로 설정되어 비밀번호 검증 우회`);
      } else {
        // requirePassword가 true이거나 undefined인 경우 비밀번호 검증
        console.log(`[DEBUG] 비밀번호 검증 시작 - requirePassword: ${options.requirePassword} (타입: ${typeof options.requirePassword})`);
        const providedPassword = options.roomPassword;
        if (!providedPassword) {
          console.log(`[DEBUG] 비밀번호가 제공되지 않음`);
          throw new Error("비밀번호를 입력해주세요.");
        }
        if (providedPassword !== this.state.roomPassword) {
          console.log(`[DEBUG] 비밀번호 검증 실패 - 제공된 비밀번호: "${providedPassword}", 방 비밀번호: "${this.state.roomPassword}"`);
          throw new Error("비밀번호가 올바르지 않습니다.");
        }
        console.log(`[DEBUG] 비밀번호 검증 성공`);
      }
      console.log(`[DEBUG] ===== 비밀방 입장 검증 완료 =====`);
    }

    const player = new PlayerState();
    player.sessionId = client.sessionId;
    if (options.authToken) {
      try {
        const decoded = jwt.verify(options.authToken, process.env.JWT_SECRET) as JwtPayload & { userId?: number };
        player.userId = decoded.userId ?? null; // JWT payload에 userId가 들어있다고 가정
        // ratingMu, ratingSigma setting
        if (player.userId !== null) {
          // DB에서 rating 값 조회 (예: Prisma 사용)
          const user = await prisma.user.findUnique({
            where: { id: player.userId },
            select: { rating_mu: true, rating_sigma: true }
          });

          if (user) {
            player.ratingMu = user.rating_mu;
            player.ratingSigma = user.rating_sigma;
          } else {
            // DB에 유저가 없으면 기본값 할당
            player.ratingMu = DEFAULT_RATING_MU;
            player.ratingSigma = DEFAULT_RATING_SIGMA;
          }
        } else {
          // 비로그인 유저 기본값
          player.ratingMu = DEFAULT_RATING_MU;
          player.ratingSigma = DEFAULT_RATING_SIGMA;
        }
      } catch (err) {
        player.userId = null; // 비로그인/비정상 토큰
        player.ratingMu = DEFAULT_RATING_MU
        player.ratingSigma = DEFAULT_RATING_SIGMA
      }
    } else {
      player.userId = null; // 비로그인 유저
      player.ratingMu = DEFAULT_RATING_MU
      player.ratingSigma = DEFAULT_RATING_SIGMA
    }
    this.state.players.set(client.sessionId, player);
    this.state.playerOrder.unshift(client.sessionId);

    if (this.state.host === "") {
      this.state.host = client.sessionId;
    }

    // ------------------------------------------------------------------- 프론트엔드 관련 추가
    // 게임 대기 화면에서 플레이어들 정보 불러오기

    // 새 플레이어 입장 알림
    this.broadcast("playerJoined", {
      playerId: client.sessionId,
      nickname: player.nickname || '익명',
      isHost: this.state.host === client.sessionId
    });

    // 대기화면 멤버 목록 동기화
    // 모든 클라이언트에게 업데이트된 플레이어 목록 전송
    // 기존 플레이어들의 준비 상태를 유지하면서 전송
    const playersList = Array.from(this.state.players.entries()).map(([id, p]) => ({
      playerId: id,
      nickname: p.nickname || '익명',
      isReady: p.ready, // 기존 준비 상태 유지
      isHost: this.state.host === id
    }));
    
    console.log(`[DEBUG] onJoin: playersUpdated 전송 - 플레이어 목록:`, playersList);
    
    this.broadcast("playersUpdated", {
      players: playersList
    });

    console.log(`플레이어 ${client.sessionId} 입장. 현재 플레이어 수: ${this.state.players.size}`);

    // 방 목록 업데이트 (첫 번째 플레이어 입장 시에만 방 생성 알림, 이후에는 방 업데이트 알림)
    if (this.state.players.size === 1) {
      // 첫 번째 플레이어 입장 시 방 생성 알림
      this.notifyLobbyRoomListUpdate("roomCreated", {
        roomId: this.roomId,
        roomType: this.state.roomType,
        roomTitle: this.state.roomTitle,
        playerCount: this.state.players.size,
        maxClients: this.maxClients
      });
    } else {
      // 추가 플레이어 입장 시 방 업데이트 알림
      this.notifyLobbyRoomListUpdate("roomUpdated", {
        roomId: this.roomId,
        roomType: this.state.roomType,
        roomTitle: this.state.roomTitle,
        playerCount: this.state.players.size,
        maxClients: this.maxClients
      });
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`[DEBUG] ===== 플레이어 퇴장 =====`);
    console.log(`[DEBUG] 플레이어 ID: ${client.sessionId}`);
    console.log(`[DEBUG] consented: ${consented}`);
    console.log(`[DEBUG] 퇴장 전 플레이어 수: ${this.state.players.size}`);
    
    const wasHost = client.sessionId === this.state.host;
    const wasCurrentPlayer = client.sessionId === this.state.playerOrder[this.state.nowPlayerIndex];
    
    // 플레이어 제거
    const playerRemoved = this.state.players.delete(client.sessionId);
    console.log(`[DEBUG] 플레이어 제거 결과: ${playerRemoved}`);
    console.log(`[DEBUG] 퇴장 후 플레이어 수: ${this.state.players.size}`);

    // playerOrder에서 해당 플레이어 제거 (더 안전한 방법)
    const idx = this.state.playerOrder.indexOf(client.sessionId);
    if (idx !== -1) {
      this.state.playerOrder.splice(idx, 1);
      console.log(`[DEBUG] playerOrder에서 플레이어 제거: ${client.sessionId} (인덱스: ${idx})`);
      console.log(`[DEBUG] 제거 후 playerOrder: ${this.state.playerOrder.join(', ')}`);
    } else {
      console.warn(`[WARNING] playerOrder에서 플레이어를 찾을 수 없음: ${client.sessionId}`);
    }

    // 턴 인덱스 조정 (나간 플레이어가 현재 턴이었거나 그 이후 순서였을 경우)
    if (idx !== -1 && idx <= this.state.nowPlayerIndex) {
      this.state.nowPlayerIndex = Math.max(0, this.state.nowPlayerIndex - 1);
      console.log(`[DEBUG] 플레이어 퇴장으로 턴 인덱스 조정: ${idx} → ${this.state.nowPlayerIndex}`);
    }
    
    // 턴 인덱스가 유효 범위를 벗어났을 경우 조정
    if (this.state.nowPlayerIndex >= this.state.playerOrder.length) {
      this.state.nowPlayerIndex = this.state.nowPlayerIndex % this.state.playerOrder.length;
      console.log(`[DEBUG] 턴 인덱스 범위 초과로 조정: ${this.state.nowPlayerIndex}`);
    }

    if (wasHost) {
      const next = this.state.players.keys().next().value;
      this.state.host = next ? next : "";
    }

    // 플레이어 퇴장 알림
    this.broadcast("playerLeft", {
      playerId: client.sessionId,
      newHost: wasHost ? this.state.host : null
    });

    // 모든 클라이언트에게 업데이트된 플레이어 목록 전송
    // 기존 플레이어들의 준비 상태를 유지하면서 전송
    const playersList = Array.from(this.state.players.entries()).map(([id, p]) => ({
      playerId: id,
      nickname: p.nickname || '익명',
      isReady: p.ready, // 기존 준비 상태 유지
      isHost: this.state.host === id
    }));
    
    console.log(`[DEBUG] onLeave: playersUpdated 전송 - 플레이어 목록:`, playersList);
    
    this.broadcast("playersUpdated", {
      players: playersList
    });

    console.log(`플레이어 ${client.sessionId} 퇴장. 현재 플레이어 수: ${this.state.players.size}`);

    // 모든 플레이어가 나갔을 경우 방 자동 삭제
    if (this.state.players.size === 0) {
      console.log(`[DEBUG] 모든 플레이어가 퇴장했습니다. 방 ${this.roomId}을 삭제합니다.`);
      
      // 방 삭제 전에 로비 방으로 알림 전송
      this.notifyLobbyRoomListUpdate("roomDeleted", {
        roomId: this.roomId
      });
      
      this.disconnect();
      return;
    } else {
      // 플레이어가 남아있는 경우 방 목록 업데이트
      this.notifyLobbyRoomListUpdate("roomUpdated", {
        roomId: this.roomId,
        roomType: this.state.roomType,
        roomTitle: this.state.roomTitle,
        playerCount: this.state.players.size,
        maxClients: this.maxClients
      });
    }

    // 게임이 완료되지 않은 경우에만 자동 우승 처리
    console.log(`[DEBUG] 자동 우승 조건 확인: round=${this.state.round}, players.size=${this.state.players.size}, gameCompleted=${this.gameCompleted}`);
    if (this.state.round > 0 && this.state.players.size === 1 && !this.gameCompleted) {
      console.log(`[DEBUG] 게임 중 플레이어가 1명만 남음. 자동 우승 처리 시작.`);
      this.handleAutoWin();
    } else if (this.state.round > 0 && this.state.players.size > 1 && !this.gameCompleted) {
      // 게임 중이고 플레이어가 2명 이상 남았을 경우
      
      // 다음 라운드에서 maxNumber 조정 예정 알림
      const expectedMaxNumber = this.maxNumberMap[this.state.players.size] ?? 15;
      if (expectedMaxNumber !== this.state.maxNumber) {
        console.log(`[DEBUG] 플레이어 수 변경으로 다음 라운드에서 maxNumber 조정 예정: ${this.state.maxNumber} → ${expectedMaxNumber}`);
        
        // 모든 클라이언트에게 다음 라운드에서 maxNumber 변경 예정 알림
        this.broadcast("maxNumberWillUpdate", {
          currentMaxNumber: this.state.maxNumber,
          expectedMaxNumber: expectedMaxNumber,
          playerCount: this.state.players.size,
          message: `플레이어 수가 ${this.state.players.size}명으로 변경되어 다음 라운드부터 카드 범위가 조정됩니다.`
        });
      }
      
      // 게임이 완료되지 않은 경우에만 턴 변경 처리
      if (!this.gameCompleted) {
        // 나간 플레이어가 현재 턴이었을 경우 다음 플레이어로 턴 변경
        if (wasCurrentPlayer) {
          console.log(`[DEBUG] 현재 턴 플레이어가 나감. 다음 플레이어로 턴 변경.`);
          this.nextPlayer();
        } else {
          // 현재 턴 플레이어가 아닌 경우 턴 변경 알림만 전송
          this.broadcast("turnChanged", {
            currentPlayerId: this.state.playerOrder[this.state.nowPlayerIndex],
            allPlayers: Array.from(this.state.players.entries()).map(([id, p]) => ({
              sessionId: id,
              nickname: p.nickname || '익명',
              score: p.score,
              remainingTiles: p.hand ? p.hand.length : 0,
              isCurrentPlayer: id === this.state.playerOrder[this.state.nowPlayerIndex]
            }))
          });
        }
      } else {
        console.log(`[DEBUG] 게임이 이미 완료되어 턴 변경을 하지 않습니다.`);
      }
    }
  }

  // ------------------------------------------------------------------- 프론트엔드 관련 추가 끝

  /**
   * 게임 중 플레이어가 1명만 남았을 때 자동 우승 처리
   */
  async handleAutoWin() {
    console.log(`[DEBUG] handleAutoWin() 실행 시작`);
    
    // 타이머 정리
    this.clearTurnTimer();
    
    // 남은 플레이어를 우승자로 처리
    const remainingPlayerId = this.state.players.keys().next().value;
    const remainingPlayer = this.state.players.get(remainingPlayerId);
    
    if (!remainingPlayer) {
      console.error(`[ERROR] 남은 플레이어를 찾을 수 없습니다.`);
      return;
    }

    console.log(`[DEBUG] 자동 우승자: ${remainingPlayer.nickname} (${remainingPlayerId})`);

    // 1) 최종 점수 수집 (점수 조정을 모두 +0으로 설정)
    const finalScores = Array.from(this.state.players.entries()).map(([sessionId, player]) => ({
      playerId: sessionId,
      userId: player.userId,
      score: player.score, // 기존 점수 유지
      nickname: player.nickname,
      rating_mu_before: player.ratingMu,
      rating_sigma_before: player.ratingSigma
    }));

    // 자동 우승의 경우 점수 조정을 모두 +0으로 설정
    const finalScoresWithRank = finalScores.map((player, index) => ({
      ...player,
      rank: 1, // 모든 플레이어를 1등으로 처리
      scoreDiff: 0 // 점수 조정을 +0으로 설정
    }));

    // 레이팅 계산 (자동 우승의 경우 레이팅 변동 없음)
    const finalScoresWithRating = finalScoresWithRank.map(player => ({
      ...player,
      rating_mu_after: player.rating_mu_before, // 레이팅 변동 없음
      rating_sigma_after: player.rating_sigma_before // 레이팅 변동 없음
    }));

    const dbSaveResults = [];

    // 2) 새로운 DB 구조로 저장: Game + GamePlayer (자동 우승, 레이팅 변동 없음)
    console.log(`[DEBUG] 자동 우승 - 새로운 DB 구조로 저장 시작`);
    
    try {
      await prisma.$transaction(async (tx: any) => {
        // 1) Game 테이블에 게임 정보 저장
        console.log(`[DEBUG] 자동 우승 - Game 테이블에 게임 정보 저장 시작`);
        const game = await tx.game.create({
          data: {
            gameId: this.roomId,
            playerCount: finalScores.length,
            totalRounds: this.state.totalRounds,
            roomType: this.state.roomType,
            roomTitle: this.state.roomTitle,
          },
        });
        console.log(`[DEBUG] 자동 우승 - Game 생성 완료: gameId=${game.id}`);

        // 2) 각 플레이어의 GamePlayer 레코드 생성 (레이팅 변동 없음)
        for (const playerData of finalScoresWithRating) {
          const { userId, score, rank, rating_mu_before, rating_sigma_before, rating_mu_after, rating_sigma_after } = playerData;
          
          if (!userId) {
            console.log(`[DEBUG] 자동 우승 - userId가 null이므로 DB 저장 건너뜀: ${playerData.nickname}`);
            dbSaveResults.push({ userId: null, success: false, reason: 'Not a logged-in user' });
            continue;
          }

          console.log(`[DEBUG] 자동 우승 - GamePlayer 생성 시작: userId=${userId}`);
          
          // GamePlayer 레코드 생성 (레이팅 변동 없음)
          await tx.gamePlayer.create({
            data: {
              gameId: game.id,
              userId,
              rank,
              score,
              rating_mu_before,
              rating_sigma_before,
              rating_mu_after,
              rating_sigma_after,
              rating_mu_change: 0, // 자동 우승의 경우 레이팅 변화값 0
            },
          });
          console.log(`[DEBUG] 자동 우승 - GamePlayer 생성 완료: userId=${userId}`);
          
          dbSaveResults.push({ userId, success: true });
        }
      });
      
      console.log(`[DEBUG] 자동 우승 - 모든 DB 저장 작업 완료`);
    } catch (err) {
      console.error(`[ERROR] 자동 우승 - DB 저장 트랜잭션 실패:`, err);
      const reason = err instanceof Error ? err.message : 'An unknown error occurred';
      dbSaveResults.push({ success: false, reason });
    }

    // 3) 최종 결과를 state에 저장
    this.finalGameResult = { 
      finalScores: finalScoresWithRating,
      dbSaveResults 
    };
    console.log(`[DEBUG] 자동 우승 - 최종 게임 결과가 생성되어 저장되었습니다.`);

    // 게임 완료 상태로 설정 (더 이상 데이터 수정하지 않음)
    this.gameCompleted = true;

    // 4) 클라이언트에게 자동 우승 결과 전송
    this.broadcast("autoWinResult", {
      winner: {
        playerId: remainingPlayerId,
        nickname: remainingPlayer.nickname || '익명'
      },
      finalScores: finalScoresWithRating,
      message: "다른 플레이어들이 나가서 자동으로 우승했습니다!"
    });

    // 5) 게임 완전 종료 알림
    this.broadcast("gameIsOver");
    
    console.log(`[DEBUG] handleAutoWin() 완료`);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
    this.clearTurnTimer();
  }


  startGame() {
    // easyMode 설정은 각 플레이어의 설정을 따르며, 방 전체의 easyMode는 플레이어 중 한 명이라도 true이면 true가 됨.
    // 이 로직은 handleEasyMode에서 처리되므로 여기서는 별도 설정 안 함.
    this.state.easyMode = [...this.state.players.values()].some(p => p.easyMode);
    this.state.maxNumber = this.maxNumberMap[this.state.players.size] ?? 15;

    // 초기화 작업 예: 턴순, 라운드 등
    this.state.round = 1;

    // 게임이 시작되면 방을 잠금
    this.lock();
  }

  startRound() {
    console.log(`[DEBUG] startRound() 호출됨 - round: ${this.state.round}, playerCount: ${this.state.players.size}`);
    
    // 플레이어 수가 변경되었을 경우 maxNumber 재조정
    const expectedMaxNumber = this.maxNumberMap[this.state.players.size] ?? 15;
    if (expectedMaxNumber !== this.state.maxNumber) {
      console.log(`[DEBUG] startRound에서 maxNumber 재조정: ${this.state.maxNumber} → ${expectedMaxNumber}`);
      this.state.maxNumber = expectedMaxNumber;
    }
    
    const maxNumber = this.state.maxNumber;
    const playerCount = this.state.players.size;

    // playerOrder와 players Map 동기화 확인 및 수정
    let order = this.state.playerOrder;
    const currentPlayerIds = Array.from(this.state.players.keys());
    
    console.log(`[DEBUG] startRound - 현재 players: ${currentPlayerIds.join(', ')}`);
    console.log(`[DEBUG] startRound - 현재 playerOrder: ${order.join(', ')}`);
    
    // playerOrder에서 존재하지 않는 플레이어 제거
    const validOrder = order.filter(playerId => this.state.players.has(playerId));
    if (validOrder.length !== order.length) {
      console.log(`[DEBUG] playerOrder 동기화 필요 - 유효하지 않은 플레이어 제거`);
      console.log(`[DEBUG] 동기화 전: ${order.join(', ')}`);
      console.log(`[DEBUG] 동기화 후: ${validOrder.join(', ')}`);
      
      // playerOrder 재구성
      this.state.playerOrder.clear();
      validOrder.forEach(playerId => this.state.playerOrder.push(playerId));
      
      // order 변수 업데이트
      order = this.state.playerOrder;
    }

    // 1) 덱 생성 및 셔플
    const deck = createShuffledDeck(maxNumber);

    // 2) 카드 분배
    const hands = dealCards(deck, playerCount);

    // 3) 분배된 카드를 playerOrder 기준으로 할당
    order.forEach((sessionId, i) => {
      const player = this.state.players.get(sessionId);
      if (player) {
        player.hand = new ArraySchema<number>(...hands[i]);
        // 새로운 라운드이므로 정렬 순서 초기화
        player.sortedHand.clear();
      }
    });

    // 4) 구름 3 가진 플레이어 찾기 (playerOrder 기준)
    const cloud3PlayerId = findPlayerWithCloud3(this.state.players, maxNumber);
    
    console.log(`[DEBUG] 구름 3 검색 결과: playerId=${cloud3PlayerId}, maxNumber=${maxNumber}`);
    console.log(`[DEBUG] 현재 playerOrder: ${order.join(', ')}`);
    console.log(`[DEBUG] 현재 플레이어 수: ${this.state.players.size}`);

    if (cloud3PlayerId === null) {
      console.error("[BUG] 구름3이 분배되지 않음! 코드 버그 점검 필요");
      this.broadcast("debugError", { reason: "구름 3 분배 누락" });
      throw new Error("구름 3 분배 누락 - 코드 버그!");
    }

    // 5) 그 플레이어 인덱스 추출
    const cloud3Index = cloud3PlayerId !== null ? order.indexOf(cloud3PlayerId) : 0;
    
    console.log(`[DEBUG] 구름 3 플레이어 인덱스: ${cloud3Index}, playerOrder: ${order.join(', ')}`);
    console.log(`[DEBUG] 구름 3 플레이어 닉네임: ${this.state.players.get(cloud3PlayerId)?.nickname}`);
    console.log(`[DEBUG] 구름 3 플레이어 ID: ${cloud3PlayerId}`);
    console.log(`[DEBUG] 현재 playerOrder 길이: ${order.length}`);
    console.log(`[DEBUG] playerOrder 상세: ${order.map((id, idx) => `${idx}:${id}`).join(', ')}`);

    // 인덱스 유효성 검사
    if (cloud3Index === -1) {
      console.error(`[ERROR] 구름 3 플레이어(${cloud3PlayerId})를 playerOrder에서 찾을 수 없음!`);
      console.error(`[ERROR] 현재 playerOrder: ${order.join(', ')}`);
      console.error(`[ERROR] 현재 players: ${Array.from(this.state.players.keys()).join(', ')}`);
      // 첫 번째 플레이어로 대체
      this.state.nowPlayerIndex = 0;
    } else {
      // 구름 3을 가진 플레이어가 선이 되도록 nowPlayerIndex 설정
      this.state.nowPlayerIndex = cloud3Index;
    }
    
    console.log(`[DEBUG] 라운드 시작 - 구름3 플레이어: ${this.state.playerOrder[this.state.nowPlayerIndex]}, nowPlayerIndex: ${this.state.nowPlayerIndex}`);

    // 6) 기타 상태 초기화
    this.state.lastType = 0;
    this.state.lastMadeType = MADE_NONE;
    this.state.lastHighestValue = -1;
    this.state.lastCards = new ArraySchema<number>();
    this.state.lastPlayerIndex = -1;
    this.state.currentTurnId = 0; // 턴 ID 초기화

    // 6-1) 보드 상태 초기화 (새 라운드마다 15X4로 리셋)
    this.state.boardCards.clear();
    this.state.boardRows.clear();
    this.state.boardCols.clear();
    this.state.boardTurnIds.clear();
    this.state.currentBoardRows = 4;  // 초기값 15X4로 리셋
    this.state.currentBoardCols = 15; // 초기값 15X4로 리셋
    console.log(`[DEBUG] 새 라운드 시작 - 보드 크기 리셋: ${this.state.currentBoardRows}x${this.state.currentBoardCols}`);

    // 7) 카드 분배 후 각 플레이어마다 자신의 상태 보내기
    console.log(`[DEBUG] roundStart 메시지 전송 시작 - 플레이어 수: ${this.state.playerOrder.length}`);
    for (const sessionId of this.state.playerOrder) {
      const player = this.state.players.get(sessionId);
      if (!player) {
        console.log(`[DEBUG] 플레이어를 찾을 수 없음: ${sessionId}`);
        continue;
      }

      const client = this.clients.find(c => c.sessionId === sessionId);
      if (!client) {
        console.log(`[DEBUG] 클라이언트를 찾을 수 없음: ${sessionId}`);
        continue;
      }

      console.log(`[DEBUG] roundStart 메시지 전송: ${sessionId}`);
      client.send("roundStart", {
        hand: player.hand.slice(),  // ArraySchema -> 일반 배열로 변환
        score: player.score,
        nickname: player.nickname,
        // ------------------------------------------------------------------- 프론트엔드 관련 추가
        maxNumber: this.state.maxNumber,
        // 모든 플레이어 정보 포함
        allPlayers: Array.from(this.state.players.entries()).map(([id, p]) => ({
          sessionId: id,
          nickname: p.nickname || '익명',
          score: p.score,
          remainingTiles: p.hand ? p.hand.length : 0,
          isCurrentPlayer: id === this.state.playerOrder[this.state.nowPlayerIndex]
        }))
        // ------------------------------------------------------------------- 프론트엔드 관련 추가 끝

      });
    }

    // 8) 라운드 시작 알림
    this.broadcast("roundStarted", {
      playerOrder: this.state.playerOrder.slice(),
      round: this.state.round,
    });

    // 9) 첫 번째 턴 시작 (타임어택 모드인 경우 타이머도 시작)
    console.log(`[DEBUG] startRound 완료 - 첫 번째 턴 시작`);
    // nextPlayer()를 호출하지 않음 - 이미 nowPlayerIndex가 구름3 플레이어로 설정됨
    
    // 타임어택 모드인 경우 첫 번째 턴 타이머 시작
    if (this.state.timeAttackMode) {
      this.startTurnTimer();
    }
  }

  nextPlayer() {
    // 기존 타이머가 있다면 정리
    this.clearTurnTimer();
    
    this.state.nowPlayerIndex = (this.state.nowPlayerIndex + 1) % this.state.playerOrder.length;
    console.log(`[DEBUG] 턴 변경 - 새로운 플레이어: ${this.state.playerOrder[this.state.nowPlayerIndex]}, nowPlayerIndex: ${this.state.nowPlayerIndex}`);
    
    if(this.state.nowPlayerIndex === this.state.lastPlayerIndex) {
      this.state.lastType = 0;
      this.state.lastMadeType = MADE_NONE;
      this.state.lastHighestValue = -1;
      this.state.lastCards = new ArraySchema<number>();
      
      // pass 스티커 때문에 추가함
      // 조합 리셋 시 모든 플레이어의 pass 상태도 리셋
      for (const player of this.state.players.values()) {
        player.hasPassed = false;
      }
      
      // pass 스티커 때문에 추가함
      // pass 상태 리셋을 모든 클라이언트에게 브로드캐스트
      this.broadcast("passReset", {
        message: "조합이 리셋되어 pass 상태가 초기화되었습니다."
      });
      
      this.broadcast("cycleEnded", {});
    }
    
    // 타임어택 모드인 경우 타이머 시작
    console.log(`[DEBUG] nextPlayer - timeAttackMode: ${this.state.timeAttackMode}`);
    if (this.state.timeAttackMode) {
      console.log(`[DEBUG] 타임어택 모드 활성화 - 타이머 시작`);
      this.startTurnTimer();
    } else {
      console.log(`[DEBUG] 프리 모드 - 타이머 시작하지 않음`);
    }
    
    // 턴 변경 시 현재 플레이어 정보 업데이트
    this.broadcast("turnChanged", {
      currentPlayerId: this.state.playerOrder[this.state.nowPlayerIndex],
      allPlayers: Array.from(this.state.players.entries()).map(([id, p]) => ({
        sessionId: id,
        nickname: p.nickname || '익명',
        score: p.score,
        remainingTiles: p.hand ? p.hand.length : 0,
        isCurrentPlayer: id === this.state.playerOrder[this.state.nowPlayerIndex]
      }))
    });
  }

  async endRound() {
    // 1. 필요한 모든 데이터를 계산합니다.
    const scoreBeforeCalculation = Array.from(this.state.players.entries()).map(([id, p]) => ({
      playerId: id,
      score: p.score,
    }));
    
    const scoreMatrix = calculateRoundScoreMatrix(this.state.players, this.state.maxNumber);
    const scoreDiffMap = calculateRoundScores(this.state.players, this.state.maxNumber);

    // 2. 최종 라운드 결과 객체를 생성합니다.
    const finalScores = Array.from(this.state.players.entries()).map(([id, p]) => ({
      playerId: id,
      score: p.hand ? p.hand.length : 0, // 프론트엔드 순위 표시는 남은 타일 수 기준
      nickname: p.nickname || '익명',
      scoreDiff: scoreDiffMap.get(id) || 0,
      remainingTiles: p.hand ? p.hand.length : 0,
    })).sort((a, b) => a.score - b.score);

    // 3. 모든 데이터를 하나의 객체로 묶습니다.
    const finalHands: Record<string, number[]> = {};
    this.state.players.forEach((player, sessionId) => {
      finalHands[sessionId] = Array.from(player.hand);
    });

    const comprehensiveResult = {
      scoreBeforeCalculation,
      scoreMatrix,
      scores: finalScores, // roundResult의 scores와 동일
      finalHands, // 모든 플레이어의 최종 패 정보 추가
      maxNumber: this.state.maxNumber, // 검증 로직을 위해 maxNumber 추가
      round: this.state.round,
      isGameEnd: this.state.round >= this.state.totalRounds,
    };

    // 4. 서버의 플레이어 상태에 실제 누적 점수를 업데이트합니다.
    for (const [sessionId, diffScore] of scoreDiffMap.entries()) {
      const player = this.state.players.get(sessionId);
      if (!player) continue;
      player.score += diffScore; // 서버에만 누적 점수 반영
    }

    // 5. 다음 라운드 준비 상태 초기화
    for (const player of this.state.players.values()) {
      player.readyForNextRound = false;
    }

    // 6. 라운드 결과를 항상 클라이언트에 전송합니다.
    this.broadcast("roundEnded", comprehensiveResult);

    // 7. 게임 종료 여부를 확인하고 후속 조치를 취합니다.
    console.log(`[DEBUG] 게임 종료 조건 확인: round=${this.state.round}, totalRounds=${this.state.totalRounds}, isGameEnd=${comprehensiveResult.isGameEnd}`);
    if (comprehensiveResult.isGameEnd) {
      // 마지막 라운드이므로, 백그라운드에서 DB 저장을 시작합니다.
      console.log(`[DEBUG] 마지막 라운드 종료. endGame()을 호출하여 DB 저장을 시작합니다.`);
      this.endGame().catch(e => console.error("[ERROR] endGame 실행 중 오류 발생:", e));
    } else {
      // 게임이 계속되면 다음 라운드 준비
      console.log(`[DEBUG] 게임 계속. 다음 라운드로 진행: ${this.state.round} → ${this.state.round + 1}`);
      this.state.round++;
      this.broadcast("waitingForNextRound");
    }
  }

  async endGame() {
    console.log(`[DEBUG] endGame() 실행 시작`);
    console.log(`[DEBUG] 현재 플레이어 수: ${this.state.players.size}`);
    
    // 1) 최종 점수 수집
    const finalScores = Array.from(this.state.players.entries()).map(([sessionId, player]) => ({
      playerId: sessionId,
      userId: player.userId,
      score: player.score,
      nickname: player.nickname,
      rating_mu_before: player.ratingMu,
      rating_sigma_before: player.ratingSigma
    }));

    console.log(`[DEBUG] 최종 점수 수집 완료:`, finalScores);

    const finalScoresWithRank = calculateRanks(finalScores);
    console.log(`[DEBUG] 순위 계산 완료:`, finalScoresWithRank);
    
    const finalScoresWithRating = calculateRatings(finalScoresWithRank);
    console.log(`[DEBUG] 레이팅 계산 완료:`, finalScoresWithRating);

    // 레이팅 변화값 계산 및 모든 플레이어 정보 생성
    const finalScoresWithChange = finalScoresWithRating.map(player => ({
      ...player,
      rating_mu_change: player.rating_mu_after - player.rating_mu_before
    }));

    // 모든 플레이어 정보 생성 (전적 열람용)
    const playerInfos = finalScoresWithChange.map(player => ({
      userId: player.userId,
      nickname: player.nickname,
      score: player.score,
      rank: player.rank,
      rating_mu_before: player.rating_mu_before,
      rating_mu_after: player.rating_mu_after,
      rating_mu_change: player.rating_mu_change
    }));

    const dbSaveResults = [];

    console.log(`[DEBUG] DB 저장 시작. 총 ${finalScoresWithChange.length}명의 플레이어 처리 예정`);

    // 4) 새로운 DB 구조로 저장: Game + GamePlayer
    console.log(`[DEBUG] 새로운 DB 구조로 저장 시작`);
    
    try {
      await prisma.$transaction(async (tx: any) => {
        // 1) Game 테이블에 게임 정보 저장
        console.log(`[DEBUG] Game 테이블에 게임 정보 저장 시작`);
        const game = await tx.game.create({
          data: {
            gameId: this.roomId,
            playerCount: finalScores.length,
            totalRounds: this.state.totalRounds,
            roomType: this.state.roomType,
            roomTitle: this.state.roomTitle,
          },
        });
        console.log(`[DEBUG] Game 생성 완료: gameId=${game.id}`);

        // 2) 각 플레이어의 GamePlayer 레코드 생성 및 User 레이팅 업데이트
        for (const playerData of finalScoresWithChange) {
          const { userId, score, rank, rating_mu_before, rating_sigma_before, rating_mu_after, rating_sigma_after, rating_mu_change } = playerData;
          
          console.log(`[DEBUG] 플레이어 처리 중: userId=${userId}, nickname=${playerData.nickname}, rank=${rank}, score=${score}`);
          
          if (!userId) {
            console.log(`[DEBUG] userId가 null이므로 DB 저장 건너뜀: ${playerData.nickname}`);
            dbSaveResults.push({ userId: null, success: false, reason: 'Not a logged-in user' });
            continue;
          }

          console.log(`[DEBUG] GamePlayer 생성 및 User 레이팅 업데이트 시작`);
          
          // GamePlayer 레코드 생성
          await tx.gamePlayer.create({
            data: {
              gameId: game.id,
              userId,
              rank,
              score,
              rating_mu_before,
              rating_sigma_before,
              rating_mu_after,
              rating_sigma_after,
              rating_mu_change,
            },
          });
          console.log(`[DEBUG] GamePlayer 생성 완료: userId=${userId}`);

          // User 레이팅 업데이트
          await tx.user.update({
            where: { id: userId },
            data: {
              rating_mu: rating_mu_after,
              rating_sigma: rating_sigma_after,
            },
          });
          console.log(`[DEBUG] User 레이팅 업데이트 완료: userId=${userId}`);
          
          dbSaveResults.push({ userId, success: true });
        }
      });
      
      console.log(`[DEBUG] 모든 DB 저장 작업 완료`);
    } catch (err) {
      console.error(`[ERROR] DB 저장 트랜잭션 실패:`, err);
      const reason = err instanceof Error ? err.message : 'An unknown error occurred';
      dbSaveResults.push({ success: false, reason });
    }

    // 최종 결과를 state에 저장하여, 나중에 클라이언트가 요청할 수 있도록 함
    this.finalGameResult = { 
      finalScores: finalScoresWithRating,
      dbSaveResults 
    };
    console.log(`[DEBUG] 최종 게임 결과가 생성되어 저장되었습니다.`);
    console.log(`[DEBUG] DB 저장 결과:`, dbSaveResults);

    // 게임 완료 상태로 설정 (더 이상 데이터 수정하지 않음)
    this.gameCompleted = true;
    console.log(`[DEBUG] 게임 완료 상태로 설정됨`);

    // 클라이언트에게 게임이 완전히 종료되었음을 알림 (결과 데이터는 포함하지 않음)
    this.broadcast("gameIsOver");
    console.log(`[DEBUG] gameIsOver 브로드캐스트 전송 완료`);
    console.log(`[DEBUG] endGame() 실행 완료`);
  }


  resetGameState() {
    // 게임을 다시 할 수 있도록 방 잠금 해제
    this.unlock();

    // 라운드, 점수, 각종 상태 초기화
    this.state.round = 0;
    this.state.lastType = 0;
    this.state.lastMadeType = MADE_NONE;
    this.state.lastHighestValue = -1;
    this.state.lastCards = new ArraySchema<number>();
    this.state.lastPlayerIndex = -1;
    this.state.nowPlayerIndex = 0;
    
    // 게임 완료 상태 초기화
    this.gameCompleted = false;
    this.finalGameResult = null;

    // 플레이어 점수 초기화 (원하면)
    for (const player of this.state.players.values()) {
      player.score = 0;
      player.hand = new ArraySchema<number>(); // 손패 초기화
      player.ready = false; // 준비 상태 초기화 (필요시)
    }

    // playerOrder 자체는 유지하되, 필요하면 초기화 가능
    // this.state.playerOrder.clear(); // 또는 유지

    // host 등 기타 상태 유지

    // 클라이언트에게 게임 초기 상태 알림 (옵션)
    this.broadcast("gameReset", {});
  }

  // 타임어택 타이머 시작
  startTurnTimer() {
    console.log(`[DEBUG] startTurnTimer 호출됨 - timeAttackMode: ${this.state.timeAttackMode}, timeLimit: ${this.state.timeLimit}`);
    
    this.clearTurnTimer(); // 기존 타이머 정리
    
    this.state.turnStartTime = Date.now();
    console.log(`[DEBUG] turnStartTime 설정: ${this.state.turnStartTime}`);
    
    this.turnTimer = setTimeout(() => {
      console.log(`[DEBUG] 타임어택 시간 초과 - 자동으로 pass 처리`);
      this.handleTimeOut();
    }, this.state.timeLimit * 1000);
    
    // 클라이언트에게 타이머 시작 알림
    console.log(`[DEBUG] turnTimerStarted 메시지 브로드캐스트:`, {
      timeLimit: this.state.timeLimit,
      turnStartTime: this.state.turnStartTime
    });
    this.broadcast("turnTimerStarted", {
      timeLimit: this.state.timeLimit,
      turnStartTime: this.state.turnStartTime
    });
  }

  // 타임어택 타이머 정리
  clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  // 시간 초과 처리
  handleTimeOut() {
    const currentPlayerId = this.state.playerOrder[this.state.nowPlayerIndex];
    const currentPlayer = this.state.players.get(currentPlayerId);
    
    if (currentPlayer) {
      console.log(`[DEBUG] 플레이어 ${currentPlayer.nickname} 시간 초과로 자동 pass`);
      
      // 클라이언트에게 시간 초과 알림
      this.broadcast("timeOut", {
        playerId: currentPlayerId,
        playerNickname: currentPlayer.nickname
      });
      
      // handlePass 함수를 재사용하여 pass 처리 (시간 초과임을 표시)
      handlePass(this, null, true);
    }
  }


}