CREATE TABLE "xconnect_user_preferences" (
    "user_uuid" UUID NOT NULL,
    "extended_server_list_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xconnect_user_preferences_pkey" PRIMARY KEY ("user_uuid")
);

ALTER TABLE "xconnect_user_preferences"
ADD CONSTRAINT "xconnect_user_preferences_user_uuid_fkey"
FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid")
ON DELETE CASCADE ON UPDATE CASCADE;
