-- Activation des comptes par e-mail : les comptes créés avant sont considérés comme activés.
UPDATE "user" SET "email_verified" = true WHERE "email_verified" = false;
