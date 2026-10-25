-- Speeds up duplicate detection (same ward + category within the last 30 days)
CREATE INDEX IDX_ISSUE_DUP ON ISSUE (WARD_ID, CATEGORY, CREATED_AT);
