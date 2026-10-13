# Actual Budget (personal fork)

Envelope budgeting app, extended in this fork with a loan book: a record of money borrowed from and lent to other people and banks.

## Loan book

**Loan**:
One borrowing or lending arrangement with a single counterparty, with its own balance. An informal loan is usually one running tab per person; a bank loan is always its own loan.
_Avoid_: Debt, IOU, tab

**Counterparty**:
The payee on the other side of a loan: the person or bank you owe, or who owes you.
_Avoid_: Lender, borrower, contact, creditor

**Direction**:
Whether a loan is money **I owe** or money **owed to me**.
_Avoid_: Type, sign

**Loan book**:
The list of all loans, with totals for what I owe and what is owed to me, overall and per counterparty.
_Avoid_: Debt tracker, loans page

**Covered purchase**:
An entry where the counterparty paid for something of mine, which counts as spending in its category and increases what I owe.
_Avoid_: Fronted expense

**Cash received**:
An entry where the counterparty put money into my account, which counts as income I can budget and increases what I owe.
_Avoid_: Disbursement, advance

**Repayment**:
Money paid toward a loan that reduces its balance.
_Avoid_: Installment, payback

**Loans account**:
The single on-budget account where covered purchases are recorded, shared by every counterparty.
_Avoid_: Debt account, loan account

**Opening balance**:
The amount already owed when a loan is added to the loan book, with no budget effect.
_Avoid_: Starting balance, principal

**Interest entry**:
An entry that raises a loan by the interest or indexation (verðbætur) from a statement, with no budget effect.
_Avoid_: Accrual, charge

**Adjustment**:
An entry that brings a loan's balance to a figure you enter, such as a bank statement total, with no budget effect.
_Avoid_: Correction, reconciliation

**Closed loan**:
A loan that is paid off and closed by me; it is hidden from the main list but kept with its history.
_Avoid_: Archived, deleted, settled
