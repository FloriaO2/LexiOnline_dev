// roomLogic/messageHandlers.ts
import { Room, Client } from "@colyseus/core";
import { MyRoomState } from "../rooms/schema/MyRoomState";
import { ArraySchema } from "@colyseus/schema"
import {
  evaluateSimpleCombo,
  evaluateMade,
  removeCardsFromHand,
  MadeEvalResult,
  MADE_NONE,
  MADE_STRAIGHT,
  MADE_STRAIGHTFLUSH,
  parseCard,
} from "../gameLogic/cardEvaluator";

// MyRoom이 구현해야 할 메서드를 포함하는 인터페이스
export interface IMyRoom extends Room<MyRoomState> {
  nextPlayer(): void;
  endRound(): void;
  clearTurnTimer(): void;
}

// 정렬 순서 저장 메시지 처리
export function handleSortOrder(room: IMyRoom, client: Client, data: any) {
  const player = room.state.players.get(client.sessionId);
  if (!player) {
    client.send("sortOrderRejected", { reason: "Player not found." });
    return;
  }

  const sortOrder: number[] = data.sortOrder;
  
  // 정렬 순서가 현재 손패의 카드들로만 구성되어 있는지 확인
  for (const cardId of sortOrder) {
    if (!player.hand.includes(cardId)) {
      client.send("sortOrderRejected", { reason: "Invalid card in sort order." });
      return;
    }
  }

  // 정렬 순서 저장
  player.sortedHand.clear();
  for (const cardId of sortOrder) {
    player.sortedHand.push(cardId);
  }

  console.log(`[DEBUG] 정렬 순서 저장: player=${client.sessionId}, sortOrder=${sortOrder.join(', ')}`);
  console.log(`[DEBUG] 저장된 sortedHand: ${Array.from(player.sortedHand).join(', ')}`);
  client.send("sortOrderSaved", { success: true });
}

// 12345/23456 스트레이트 판별 함수
function isSpecialStraight(cards: number[], maxNumber: number): { is12345: boolean; is23456: boolean } {
  // 카드 개수 자체가 안 맞으면 무조건 false 리턴
  if (cards.length !== 5) {
    return { is12345: false, is23456: false };
  }
  const parsed = cards.map(card => parseCard(card, maxNumber));
  const values = parsed.map(p => p.value);
  const sortedValues = [...values].sort((a, b) => a - b); // 오름차순 정렬
  const actualNumbers = sortedValues.map(v => v + 1); // value를 실제 숫자로 변환
  
  const is12345 = actualNumbers.length === 5 && 
    actualNumbers[0] === 1 && actualNumbers[1] === 2 && actualNumbers[2] === 3 && 
    actualNumbers[3] === 4 && actualNumbers[4] === 5;
  const is23456 = actualNumbers.length === 5 && 
    actualNumbers[0] === 2 && actualNumbers[1] === 3 && actualNumbers[2] === 4 && 
    actualNumbers[3] === 5 && actualNumbers[4] === 6;
  
  return { is12345, is23456 };
}

// submit 메시지 처리
export function handleSubmit(room: IMyRoom, client: Client, data: any) {
  const submitCards: number[] = data.submitCards.map((item: string) => parseInt(item, 10));
  
  console.log(`[DEBUG] 카드 제출 시도: player=${client.sessionId}, cards=${submitCards.join(', ')}`);
  
  // 제출된 카드들의 상세 정보 출력
  submitCards.forEach(card => {
    const { type, value } = parseCard(card, room.state.maxNumber);
    const actualNumber = value + 1; // 사용자 공식: value + 1
    const typeNames = ['구름', '별', '달', '태양'];
    console.log(`[DEBUG] 제출 카드: ${card} = ${typeNames[type]} ${actualNumber}`);
  });

  // 턴 검사
  console.log(`[DEBUG] 턴 검사: client=${client.sessionId}, currentPlayer=${room.state.playerOrder[room.state.nowPlayerIndex]}, nowPlayerIndex=${room.state.nowPlayerIndex}`);
  if (client.sessionId !== room.state.playerOrder[room.state.nowPlayerIndex]) {
    console.log(`[DEBUG] 턴 거부: ${client.sessionId}는 현재 턴이 아님`);
    client.send("submitRejected", { reason: "Not your turn." });
    return;
  }

  // 제출 카드 수 검사
  if (submitCards.length === 0) {
    client.send("submitRejected", { reason: "Submit any card or pass." });
    return;
  }
  if (submitCards.length === 4) {
    client.send("submitRejected", { reason: "You cannot submit 4 cards." });
    return;
  }
  if (submitCards.length > 5) {
    client.send("submitRejected", { reason: "You cannot submit more than 5 cards." });
    return;
  }

  // lastType 0이면 첫 제출로 타입 자유
  if (room.state.lastType !== 0) {
    // 5장 조합인 경우 lastMadeType이 설정되어 있어야 함
    if (submitCards.length === 5) {
      if (room.state.lastMadeType === MADE_NONE) {
        client.send("submitRejected", { reason: "Wrong cards: cannot submit 5 cards without made type." });
        return;
      }
    } else if (submitCards.length !== room.state.lastType) {
      const lastTypeText = room.state.lastType === 5 ? "5장 조합" : `${room.state.lastType}장`;
      const currentTypeText = submitCards.length === 5 ? "5장 조합" : `${submitCards.length}장`;
      client.send("submitRejected", { reason: `Wrong cards: need ${lastTypeText}, got ${currentTypeText}.` });
      return;
    }
  }

  const player = room.state.players.get(client.sessionId);
  if (!player) {
    client.send("invalidPlayer", { reason: "Player information invalid." });
    room.disconnect();
    return;
  }

  // 카드 소유 여부 확인
  console.log(`[DEBUG] 플레이어 손패: ${player.hand.join(', ')}`);
  for (const card of submitCards) {
    if (!player.hand.includes(card)) {
      console.log(`[DEBUG] 카드 ${card}를 보유하지 않음!`);
      client.send("noCard", { reason: "You do not hold this card." });
      return;
    }
  }

  let result: MadeEvalResult;

  if (submitCards.length < 4) {
    result = evaluateSimpleCombo(submitCards, room.state.maxNumber);
    if (!result.valid) {
      client.send("submitRejected", { reason: "Wrong cards: invalid combo." });
      return;
    }
    console.log(`[DEBUG] 카드 순위 비교: 현재 제출=${result.value}, 이전 최고값=${room.state.lastHighestValue}`);
    if (room.state.lastHighestValue >= result.value) {
      console.log(`[DEBUG] ❌ 제출 거부: ${result.value} <= ${room.state.lastHighestValue}`);
      console.log(`[DEBUG] 거부된 카드 상세 정보:`);
      submitCards.forEach(card => {
        const { type, value } = parseCard(card, room.state.maxNumber);
        const actualNumber = value + 1;
        const typeNames = ['구름', '별', '달', '태양'];
        console.log(`[DEBUG]   - 카드 ${card} = ${typeNames[type]} ${actualNumber} (type=${type}, value=${value})`);
      });
      console.log(`[DEBUG] 현재 족보: type=${result.type}, value=${result.value}`);
      console.log(`[DEBUG] 이전 최고: lastHighestValue=${room.state.lastHighestValue}, lastMadeType=${room.state.lastMadeType}`);
      client.send("submitRejected", { reason: "Wrong cards: order is lower." });
      return;
    }
    console.log(`[DEBUG] ✅ 제출 승인: ${result.value} > ${room.state.lastHighestValue}`);
    room.state.lastHighestValue = result.value;
    room.state.lastMadeType = MADE_NONE;
  } else {
    console.log(`[DEBUG] 5장 카드 평가: cards=${submitCards.join(', ')}, maxNumber=${room.state.maxNumber}`);
    result = evaluateMade(submitCards, room.state.maxNumber);
    console.log(`[DEBUG] 평가 결과: type=${result.type}, value=${result.value}, valid=${result.valid}`);
    if (!result.valid) {
      client.send("submitRejected", { reason: "Wrong cards: not made cards." });
      return;
    }
    // 스트레이트 또는 스트레이트플러쉬 타입이고 이전 조합이 있는 경우, 12345/23456 특수 케이스 처리
    let canSubmit = false;
    const isStraightType = (type: number) => type === MADE_STRAIGHT || type === MADE_STRAIGHTFLUSH;
    
    if (isStraightType(result.type) && isStraightType(room.state.lastMadeType) && room.state.lastCards.length === 5) {
      const currentSpecial = isSpecialStraight(submitCards, room.state.maxNumber);
      const previousSpecial = isSpecialStraight(Array.from(room.state.lastCards), room.state.maxNumber);
      
      // 23456 다음에 12345를 내려고 하는 경우 → 등록 가능
      if (previousSpecial.is23456 && currentSpecial.is12345) {
        canSubmit = true;
        console.log(`[DEBUG] ✅ 특수 케이스: 23456 다음에 12345 제출 승인`);
      }
      // 12345 다음에 23456을 내려고 하는 경우 → 등록 불가
      else if (previousSpecial.is12345 && currentSpecial.is23456) {
        canSubmit = false;
        console.log(`[DEBUG] ❌ 특수 케이스: 12345 다음에 23456 제출 거부`);
      }
      // 같은 특수 스트레이트끼리 비교 (12345끼리, 23456끼리) → 기존 로직대로 compareValue 비교
      else if ((previousSpecial.is12345 && currentSpecial.is12345) || (previousSpecial.is23456 && currentSpecial.is23456)) {
        canSubmit = result.value > room.state.lastHighestValue;
        console.log(`[DEBUG] 같은 특수 스트레이트 비교: ${canSubmit ? '승인' : '거부'}`);
      }
      // 하나만 특수 스트레이트인 경우 → 일반 compareValue 비교
      else {
        canSubmit = result.value > room.state.lastHighestValue;
      }
    } else {
      // 일반 비교 로직
      canSubmit = result.type > room.state.lastMadeType ||
        (result.type === room.state.lastMadeType && result.value > room.state.lastHighestValue);
    }
    
    if (!canSubmit) {
      console.log(`[DEBUG] ❌ 5장 조합 제출 거부`);
      console.log(`[DEBUG] 거부된 카드 상세 정보:`);
      submitCards.forEach(card => {
        const { type, value } = parseCard(card, room.state.maxNumber);
        const actualNumber = value + 1;
        const typeNames = ['구름', '별', '달', '태양'];
        console.log(`[DEBUG]   - 카드 ${card} = ${typeNames[type]} ${actualNumber} (type=${type}, value=${value})`);
      });
      console.log(`[DEBUG] 현재 족보: type=${result.type}, value=${result.value}`);
      console.log(`[DEBUG] 이전 족보: lastMadeType=${room.state.lastMadeType}, lastHighestValue=${room.state.lastHighestValue}`);
      console.log(`[DEBUG] 비교 결과: type비교=${result.type} vs ${room.state.lastMadeType}, value비교=${result.value} vs ${room.state.lastHighestValue}`);
      client.send("submitRejected", { reason: "Wrong cards: order is lower." });
      return;
    }
    room.state.lastMadeType = result.type;
    room.state.lastHighestValue = result.value;
    room.state.lastType = 4; // 5장 조합을 나타내는 타입으로 설정
  }

  // 제출 카드 손패에서 제거
  removeCardsFromHand(player.hand, submitCards);
  
  // 정렬 순서에서도 제출된 카드들 제거
  for (const card of submitCards) {
    const index = player.sortedHand.indexOf(card);
    if (index !== -1) {
      player.sortedHand.splice(index, 1);
    }
  }

  // pass 스티커 때문에 추가함
  // 모든 플레이어의 pass 상태 리셋 (새로운 패가 제출되었으므로)
  for (const player of room.state.players.values()) {
    player.hasPassed = false;
  }
  
  // pass 스티커 때문에 추가함
  // pass 상태 리셋을 모든 클라이언트에게 브로드캐스트
  room.broadcast("passReset", {
    message: "새로운 패가 제출되어 pass 상태가 리셋되었습니다."
  });

  // 상태 업데이트
  room.state.lastType = submitCards.length;
  room.state.lastCards = new ArraySchema<number>(...submitCards);
  room.state.lastPlayerIndex = room.state.nowPlayerIndex;

  // 카드 위치 결정 (모든 유저에게 동일한 위치 보장)
  let boardSize = { rows: room.state.currentBoardRows, cols: room.state.currentBoardCols }; // 현재 보드 크기
  // 카드 제출할 때마다 턴 ID 증가
  room.state.currentTurnId++;
  const currentTurnId = room.state.currentTurnId;
  
  // 게임 보드 동기화 관련
  // 현재 게임 보드 상태를 room.state에서 가져오기
  const boardCards: Array<{ row: number; col: number; turnId: number }> = [];
  for (let i = 0; i < room.state.boardCards.length; i++) {
    boardCards.push({
      row: room.state.boardRows[i],
      col: room.state.boardCols[i],
      turnId: room.state.boardTurnIds[i]
    });
  }
  
  // 위치 결정
  let positionResult = findCardPosition(submitCards, boardCards, boardSize, currentTurnId);
  
  // 위치를 찾지 못한 경우 보드 크기 확장 시도
  if (!positionResult.success) {
    console.log(`[DEBUG] 카드 위치 결정 실패, 보드 크기 확장 시도`);
    
    // 15x4에서 20x5로 확장
    if (room.state.currentBoardRows === 4 && room.state.currentBoardCols === 15) {
      room.state.currentBoardRows = 5;
      room.state.currentBoardCols = 20;
      boardSize = { rows: 5, cols: 20 };
      console.log(`[DEBUG] 보드 크기 확장: 15x4 -> 20x5`);
      
      // 확장된 보드로 다시 위치 찾기 시도
      positionResult = findCardPosition(submitCards, boardCards, boardSize, currentTurnId);
    }
    // 20x5에서 25x6으로 확장
    else if (room.state.currentBoardRows === 5 && room.state.currentBoardCols === 20) {
      room.state.currentBoardRows = 6;
      room.state.currentBoardCols = 25;
      boardSize = { rows: 6, cols: 25 };
      console.log(`[DEBUG] 보드 크기 확장: 20x5 -> 25x6`);
      
      // 확장된 보드로 다시 위치 찾기 시도
      positionResult = findCardPosition(submitCards, boardCards, boardSize, currentTurnId);
    }
  }
  
  if (positionResult.success && positionResult.position) {
    console.log(`[DEBUG] 카드 위치 결정: row=${positionResult.position.row}, col=${positionResult.position.col}`);
    
    // 게임 보드 동기화 관련
    // 게임 보드 상태에 새로운 카드들 추가
    for (let i = 0; i < submitCards.length; i++) {
      room.state.boardCards.push(submitCards[i]);
      room.state.boardRows.push(positionResult.position!.row);
      room.state.boardCols.push(positionResult.position!.col + i);
      room.state.boardTurnIds.push(currentTurnId);
    }
    
    room.broadcast("submitted", { 
      cards: submitCards, 
      playerId: client.sessionId,
      position: positionResult.position,
      maxNumber: room.state.maxNumber,
      turnId: currentTurnId,
      boardSize: boardSize // 확장된 보드 크기도 함께 전송
    });
  } else {
    console.log(`[DEBUG] 카드 위치 결정 실패, 기본 위치 사용`);
    // 위치를 찾지 못한 경우 기본 위치 사용
    const defaultPosition = { row: 0, col: 0 };
    
    // 게임 보드 동기화 관련
    // 게임 보드 상태에 새로운 카드들 추가
    for (let i = 0; i < submitCards.length; i++) {
      room.state.boardCards.push(submitCards[i]);
      room.state.boardRows.push(defaultPosition.row);
      room.state.boardCols.push(defaultPosition.col + i);
      room.state.boardTurnIds.push(currentTurnId);
    }
    
    room.broadcast("submitted", { 
      cards: submitCards, 
      playerId: client.sessionId,
      position: defaultPosition,
      maxNumber: room.state.maxNumber,
      turnId: currentTurnId,
      boardSize: boardSize // 현재 보드 크기도 함께 전송
    });
  }

  // 플레이어 손패 비었으면 라운드 종료 호출
  if (player.hand.length === 0) {
    room.clearTurnTimer(); // 타이머 정리
    room.endRound();
    return;
  }

  // 다음 플레이어로 턴 이동
  room.nextPlayer();
}

// pass 메시지 처리
export function handlePass(room: IMyRoom, client: Client | null, isTimeOut: boolean = false) {
  // client가 있는 경우 (수동 pass) 턴 체크
  if (client && client.sessionId !== room.state.playerOrder[room.state.nowPlayerIndex]) {
    client.send("passRejected", { reason: "Not your turn." });
    return;
  }
  
  // pass 스티커 때문에 추가함
  // 현재 플레이어의 pass 상태를 true로 설정
  const currentPlayerId = room.state.playerOrder[room.state.nowPlayerIndex];
  const currentPlayer = room.state.players.get(currentPlayerId);
  if (currentPlayer) {
    currentPlayer.hasPassed = true;
  }
  
  // pass 상태를 모든 클라이언트에게 브로드캐스트
  room.broadcast("playerPassed", {
    playerId: currentPlayerId,
    hasPassed: true
  });
  
  // 전체 멤버수-1명이 pass했는지 확인
  const passedPlayersCount = Array.from(room.state.players.values()).filter(p => p.hasPassed).length;
  const totalPlayersCount = room.state.players.size;
  
  if (passedPlayersCount >= totalPlayersCount - 1) {
    // 블라인드모드일 때는 애니메이션 완료 후 턴을 넘기도록 처리
    if (room.state.blindMode) {
      // 게임보드의 모든 패들을 뒤집기 (카드 번호는 유지하되, 뒤집힌 상태로 표시)
      room.broadcast("cardsFlipped", {
        message: "블라인드 모드: 모든 패가 뒤집혔습니다."
      });
      
      // 애니메이션 완료 후 턴을 넘기도록 지연 처리
      setTimeout(() => {
        // 모든 플레이어의 pass 상태 리셋
        for (const player of room.state.players.values()) {
          player.hasPassed = false;
        }
        
        // pass 상태 리셋을 모든 클라이언트에게 브로드캐스트
        room.broadcast("passReset", {
          message: "모든 플레이어가 pass하여 새로운 라운드가 시작됩니다."
        });
        
        // 턴 넘기기
        room.nextPlayer();
      }, 800); // 애니메이션 시간과 동일 (0.8초)
    } else {
      // 일반 모드일 때는 기존대로 즉시 처리
      // 모든 플레이어의 pass 상태 리셋
      for (const player of room.state.players.values()) {
        player.hasPassed = false;
      }
      
      // pass 상태 리셋을 모든 클라이언트에게 브로드캐스트
      room.broadcast("passReset", {
        message: "모든 플레이어가 pass하여 새로운 라운드가 시작됩니다."
      });
      
      // 턴 넘기기
      room.nextPlayer();
    }
  } else {
    // pass 조건이 만족되지 않았을 때는 즉시 턴 넘기기
    room.nextPlayer();
  }
}

// ready 상태 변경 처리
export function handleReady(room: IMyRoom, client: Client, data: any) {
  const player = room.state.players.get(client.sessionId);
  if (!player) {
    console.log(`[DEBUG] handleReady: 플레이어를 찾을 수 없음 - sessionId: ${client.sessionId}`);
    return;
  }

  const oldReadyState = player.ready;
  
  if (typeof data.ready === "boolean") {
    player.ready = data.ready;
  } else {
    // 토글 방식 (필요 시 주석 해제)
    // player.ready = !player.ready;
  }

  console.log(`[DEBUG] handleReady: 플레이어 ${client.sessionId} 준비 상태 변경 - ${oldReadyState} -> ${player.ready}`);

  room.broadcast("readyUpdate", {
    playerId: client.sessionId,
    ready: player.ready,
  });
}

// easyMode 상태 변경 처리
export function handleEasyMode(room: IMyRoom, client: Client, data: any) {
  const player = room.state.players.get(client.sessionId);
  if (!player) return;

  if (typeof data.easyMode === "boolean") {
    player.easyMode = data.easyMode;

    // 다른 클라이언트에게 이 플레이어의 이지모드 상태 변경을 알림
    room.broadcast("playerEasyModeChanged", {
      playerId: client.sessionId,
      easyMode: player.easyMode,
    }, { except: client }); // 변경을 보낸 클라이언트는 제외

    console.log(`[DEBUG] Player ${client.sessionId} set easyMode to ${player.easyMode}`);
  }
}

// parseCard 임포트용 타입 선언 (실제 import는 MyRoom.ts에서 진행)

// 카드 위치 결정 함수 (프론트엔드와 동일한 로직)
function findCardPosition(
  newCards: number[],
  boardCards: Array<{ row: number; col: number; turnId: number }>,
  boardSize: { rows: number; cols: number },
  currentTurnId: number
): { success: boolean; position?: { row: number; col: number }; expanded?: boolean } {
  // 가능한 모든 위치를 찾아서 랜덤하게 선택
  const availablePositions: Array<{ row: number; col: number }> = [];
  
  // 모든 행에서 시도
  for (let row = 0; row < boardSize.rows; row++) {
    // 해당 행의 모든 기존 카드 위치 확인
    const rowCards = boardCards.filter(c => c.row === row).sort((a, b) => a.col - b.col);
    
    // 해당 행에 카드가 없으면 모든 위치가 가능
    if (rowCards.length === 0) {
      if (newCards.length <= boardSize.cols) {
        for (let startCol = 0; startCol <= boardSize.cols - newCards.length; startCol++) {
          availablePositions.push({ row, col: startCol });
        }
      }
      continue;
    }
    
    // 기존 카드들 사이의 빈 공간 찾기
    for (let startCol = 0; startCol <= boardSize.cols - newCards.length; startCol++) {
      let canPlace = true;
      
      // 1. 새로운 카드들이 들어갈 위치에 기존 카드가 있는지 확인
      for (let i = 0; i < newCards.length; i++) {
        const col = startCol + i;
        const existingCard = rowCards.find(c => c.col === col);
        if (existingCard) {
          canPlace = false;
          break;
        }
      }
      
      if (!canPlace) continue;
      
      // 2. 좌측 여백 확인 (새로운 카드들 왼쪽에 기존 카드가 있으면 반드시 한 칸 이상 여백 필요)
      const leftCard = rowCards.find(c => c.col === startCol - 1);
      if (leftCard) {
        canPlace = false;
        continue;
      }
      
      // 3. 우측 여백 확인 (새로운 카드들 오른쪽에 기존 카드가 있으면 반드시 한 칸 이상 여백 필요)
      const rightCard = rowCards.find(c => c.col === startCol + newCards.length);
      if (rightCard) {
        canPlace = false;
        continue;
      }
      
      if (canPlace) {
        availablePositions.push({ row, col: startCol });
      }
    }
  }
  
  // 가능한 위치가 있으면 랜덤하게 선택
  if (availablePositions.length > 0) {
    const randomIndex = Math.floor(Math.random() * availablePositions.length);
    return { success: true, position: availablePositions[randomIndex] };
  }
  
  return { success: false };
}
