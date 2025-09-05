// src/rooms/schema/MyRoomState.ts
import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";

export class MyRoomState extends Schema {

  @type("string") host = "";

  @type("int8") lastPlayerIndex = 0;

  @type("int8") lastHighestValue = -1; // order decision

  @type("int8") lastType = 0; // 0: starting, 1: single, 2: pair, 3: triple, 5: made

  @type("int8") lastMadeType = 0; // 0: not made, 1: straight, 2: flush, 3: full house, 4: four cards, 5: straight flush

  @type([ "int8" ]) lastCards = new ArraySchema<number>();

  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

  @type([ "string" ]) playerOrder = new ArraySchema<string>();

  @type("int8") totalRounds = 3;

  @type("int8") round = 0;

  @type("boolean") easyMode = false;

  @type("boolean") blindMode = false; // false: 공개모드, true: 블라인드모드

  @type("int8") nowPlayerIndex = 0;

  @type("int8") maxNumber = 0;

  // 게임 보드 상태 추적
  @type([ "int8" ]) boardCards = new ArraySchema<number>(); // 카드 번호들
  @type([ "int8" ]) boardRows = new ArraySchema<number>(); // 각 카드의 행 위치
  @type([ "int8" ]) boardCols = new ArraySchema<number>(); // 각 카드의 열 위치
  @type([ "int8" ]) boardTurnIds = new ArraySchema<number>(); // 각 카드의 턴 ID

  @type("int8") currentTurnId = 0; // 현재 턴 ID (카드 제출할 때마다 증가)

  // 보드 크기 관리
  @type("int8") currentBoardRows = 4; // 현재 보드 행 수
  @type("int8") currentBoardCols = 15; // 현재 보드 열 수

}
