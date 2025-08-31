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

export class MyRoom extends Room<MyRoomState> implements IMyRoom {
  maxClients = 5;
  state = new MyRoomState();
  private finalGameResult: any = null;
  
  // 방이 비어있을 때 자동 삭제 시간 (30분)
  autoDispose = false;

  maxNumberMap: Record<number, number> = { 3: 9, 4: 13, 5: 15 };

  onCreate(options: any) {
    console.log(`[DEBUG] 방 생성됨: ${this.roomId}`);
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
        totalRounds: this.state.totalRounds
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
        client.send("finalResult", this.finalGameResult);
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

      if (this.state.players.size < 3) {
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
    if (this.state.round > 0) {
      throw new Error("게임이 이미 시작되었습니다.");
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
  }

  onLeave(client: Client, consented: boolean) {
    const wasHost = client.sessionId === this.state.host;
    
    this.state.players.delete(client.sessionId);

    const idx = this.state.playerOrder.indexOf(client.sessionId);
    if (idx !== -1) this.state.playerOrder.splice(idx, 1);

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
  }

  // ------------------------------------------------------------------- 프론트엔드 관련 추가 끝

  onDispose() {
    console.log("room", this.roomId, "disposing...");
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
    
    const maxNumber = this.state.maxNumber;
    const playerCount = this.state.players.size;

    // playerOrder가 이미 입장 역순으로 관리되고 있다고 가정
    const order = this.state.playerOrder;

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

    if (cloud3PlayerId === null) {
      console.error("[BUG] 구름3이 분배되지 않음! 코드 버그 점검 필요");
      this.broadcast("debugError", { reason: "구름 3 분배 누락" });
      throw new Error("구름 3 분배 누락 - 코드 버그!");
    }

    // 5) 그 플레이어 인덱스 추출
    const cloud3Index = cloud3PlayerId !== null ? order.indexOf(cloud3PlayerId) : 0;
    
    console.log(`[DEBUG] 구름 3 플레이어 인덱스: ${cloud3Index}, playerOrder: ${order.join(', ')}`);

    this.state.nowPlayerIndex = cloud3Index;
    
    console.log(`[DEBUG] 라운드 시작 - 구름3 플레이어: ${this.state.playerOrder[cloud3Index]}, nowPlayerIndex: ${cloud3Index}`);

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
  }

  nextPlayer() {
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
    if (comprehensiveResult.isGameEnd) {
      // 마지막 라운드이므로, 백그라운드에서 DB 저장을 시작합니다.
      console.log(`[DEBUG] 마지막 라운드 종료. endGame()을 호출하여 DB 저장을 시작합니다.`);
      this.endGame().catch(e => console.error("[ERROR] endGame 실행 중 오류 발생:", e));
    } else {
      // 게임이 계속되면 다음 라운드 준비
      this.state.round++;
      this.broadcast("waitingForNextRound");
    }
  }

  async endGame() {
    console.log(`[DEBUG] endGame() 실행 시작`);
    // 1) 최종 점수 수집
    const finalScores = Array.from(this.state.players.entries()).map(([sessionId, player]) => ({
      playerId: sessionId,
      userId: player.userId,
      score: player.score,
      nickname: player.nickname,
      rating_mu_before: player.ratingMu,
      rating_sigma_before: player.ratingSigma
    }));

    const finalScoresWithRank = calculateRanks(finalScores);
    const finalScoresWithRating = calculateRatings(finalScoresWithRank);

    const dbSaveResults = [];

    // 4) 로그인 유저에 대해서만 DB 저장
    for (const playerData of finalScoresWithRating) {
      const { userId, score, rank, rating_mu_before, rating_sigma_before, rating_mu_after, rating_sigma_after } = playerData;
      
      if (!userId) {
        dbSaveResults.push({ userId: null, success: false, reason: 'Not a logged-in user' });
        continue;
      }

      console.log(`[DEBUG] 유저 ${userId}의 DB 저장을 시도합니다.`);
      try {
        await prisma.$transaction(async (tx) => {
          await tx.gameHistory.create({
            data: {
              userId,
              playerCount: finalScores.length,
              rank,
              score,
              scoresAll: finalScores.map(f => f.score),
              rating_mu_before,
              rating_sigma_before,
              rating_mu_after,
              rating_sigma_after,
              gameId: this.roomId,
            },
          });

          await tx.user.update({
            where: { id: userId },
            data: {
              rating_mu: rating_mu_after,
              rating_sigma: rating_sigma_after,
            },
          });
        });
        console.log(`[DEBUG] 유저 ${userId}의 게임 결과 및 레이팅 DB 저장 성공`);
        dbSaveResults.push({ userId, success: true });
      } catch (err) {
        console.error(`[ERROR] 유저 ${userId}의 DB 저장 트랜잭션 실패:`, err);
        const reason = err instanceof Error ? err.message : 'An unknown error occurred';
        dbSaveResults.push({ userId, success: false, reason });
      }
    }

    // 최종 결과를 state에 저장하여, 나중에 클라이언트가 요청할 수 있도록 함
    this.finalGameResult = { 
      finalScores: finalScoresWithRating,
      dbSaveResults 
    };
    console.log(`[DEBUG] 최종 게임 결과가 생성되어 저장되었습니다.`);

    // 클라이언트에게 게임이 완전히 종료되었음을 알림 (결과 데이터는 포함하지 않음)
    this.broadcast("gameIsOver");
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

}
