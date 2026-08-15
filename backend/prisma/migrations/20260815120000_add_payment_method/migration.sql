-- Add the wallet method a payment was made with.
ALTER TABLE "Payment" ADD COLUMN "method" TEXT NOT NULL DEFAULT 'WEPAY';

-- Rename the confirmation reference column without dropping existing data.
ALTER TABLE "Payment" RENAME COLUMN "instapayRef" TO "externalRef";