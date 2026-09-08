-- A given phone number / chat id / email address can only ever be linked to
-- one account. Safe to add: verified zero existing duplicates on (type, externalId).
CREATE UNIQUE INDEX "channels_type_externalId_key" ON "channels"("type", "externalId");
