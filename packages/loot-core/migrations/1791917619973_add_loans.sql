BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS loans
  (id TEXT PRIMARY KEY,
   name TEXT,
   payee TEXT,
   direction TEXT DEFAULT 'owe',
   start_date INTEGER,
   opening_balance INTEGER DEFAULT 0,
   income_category TEXT,
   expense_category TEXT,
   closed INTEGER DEFAULT 0,
   tombstone INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS loan_entries
  (id TEXT PRIMARY KEY,
   loan TEXT,
   date INTEGER,
   kind TEXT,
   amount INTEGER DEFAULT 0,
   notes TEXT,
   tombstone INTEGER DEFAULT 0);

ALTER TABLE transactions ADD COLUMN loan TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS trans_loan ON transactions (loan);

COMMIT;
