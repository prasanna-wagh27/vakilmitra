-- Resolved other-rights flags from before rule_key existed have rule_key ''. The rule now keys each
-- flag by its entry text, so backfill it from the message (both languages end with: "<entry>".)
-- Without this, every previously resolved other-rights flag would come back unresolved.
UPDATE "flag"
SET "rule_key" = substring("message" from '"(.*)"\.$')
WHERE "rule" = 'OTHER_RIGHTS_ENTRY' AND "rule_key" = '' AND "message" ~ '"(.*)"\.$';
