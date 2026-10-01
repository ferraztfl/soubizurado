-- "ALL_COURSES": access to every published course (given by the Premium subscription and the yearly
-- Premium offer; exam combos keep granting only their own course). Widens the allowed kinds; no data change.
ALTER TABLE "entitlements" DROP CONSTRAINT "entitlements_kind_check";
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_kind_check" CHECK ("kind" IN ('QUESTION_BANK', 'COURSE', 'ALL_COURSES'));

ALTER TABLE "offer_grants" DROP CONSTRAINT "offer_grants_kind_check";
ALTER TABLE "offer_grants" ADD CONSTRAINT "offer_grants_kind_check" CHECK ("kind" IN ('QUESTION_BANK', 'COURSE', 'ALL_COURSES'));
