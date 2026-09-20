export type Frequency = "Monthly" | "Weekly" | "Quarterly" | "Half-yearly" | "Yearly";

export type IncomeRecord = { amount: number; frequency: Frequency };
export type ExpenseRecord = { amount: number; frequency: Frequency; category: string };
export type InvestmentRecord = { investedAmount: number; currentValue: number; monthlyAmount: number };
export type LoanRecord = { outstanding: number; emi: number; interestRate: number; type: string };
export type GoalRecord = { targetAmount: number; currentAmount: number; targetDate: string };

export type FinancialInput = {
  income: IncomeRecord[];
  expenses: ExpenseRecord[];
  investments: InvestmentRecord[];
  loans: LoanRecord[];
  goals: GoalRecord[];
  liquidEmergencySavings?: number;
};
