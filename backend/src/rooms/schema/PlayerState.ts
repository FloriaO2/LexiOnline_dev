// src/rooms/schema/PlayerState.ts
import { Schema, type, ArraySchema } from "@colyseus/schema";
import { DEFAULT_RATING_MU, DEFAULT_RATING_SIGMA } from "../../constants/rating";

export class PlayerState extends Schema {
  @type("string") sessionId = "";

  @type("number") userId: number | null = null;

  @type("number") ratingMu = DEFAULT_RATING_MU;

  @type("number") ratingSigma = DEFAULT_RATING_SIGMA;

  @type([ "int8" ]) hand = new ArraySchema<number>();

  @type([ "int8" ]) sortedHand = new ArraySchema<number>();

  @type("number") score = 0;

  @type("string") nickname = "";

  @type("boolean") ready = false;

  @type("boolean") easyMode = false;

  @type("boolean") hasPassed = false;

  @type("boolean") readyForNextRound = false;
}
