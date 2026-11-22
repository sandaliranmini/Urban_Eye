-- Extends CLOSURE_TYPE ENUM on ISSUE table to support supervisor approvals and dispute overruling
ALTER TABLE ISSUE
MODIFY COLUMN CLOSURE_TYPE ENUM('Reporter Confirmed', 'Auto Closed', 'Supervisor Approved', 'Supervisor Overruled') NULL;

-- Allows full supervisor rework instructions and citizen dispute dialogue without 500-char truncation
ALTER TABLE REPORT_VERIFICATION
MODIFY COLUMN REMARKS TEXT NULL;

-- Extends AUDIT_LOG ENTITY_TYPE ENUM to support administrative WARD and COUNCIL operations
ALTER TABLE AUDIT_LOG
MODIFY COLUMN ENTITY_TYPE ENUM('ISSUE', 'REPORT_VERIFICATION', 'RESOLUTION_PROOF', 'CITIZEN', 'OFFICER', 'EMERGENCY_ALERT', 'COMMENT', 'VOTE', 'ANNOUNCEMENT', 'SYSTEM', 'WARD', 'COUNCIL') NOT NULL;

