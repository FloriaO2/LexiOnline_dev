-- AddGameHistoryFieldsForMatchHistory
ALTER TABLE "GameHistory" ADD COLUMN "rating_mu_change" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "GameHistory" ADD COLUMN "playerInfos" JSONB NOT NULL DEFAULT '[]';
