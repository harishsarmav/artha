export type Frequency = "Monthly" | "Weekly" | "Quarterly" | "Half-yearly" | "Yearly" | string;

export type EngineProfile = {
  name?: string;
  age?: number;
  dependents?: number;
  riskProfile?: string;
  investmentHorizon?: string;
  primaryGoal?: string;
  lifeCover?: number;
  healthCover?: number;
  cashSavings?: number;
};

export type EngineIncome = { amount: number; frequency: Frequency };
export type EngineExpense = { amount: number; frequency: Frequency; category: string };
export type EngineInvestment = {
  investedAmount: number;
  currentValue: number;
  monthlyAmount: number;
  category?: string;
};
export type EngineLoan = {
  outstanding: number;
  emi: number;
  interestRate: number;
  type: string;
};
export type EngineInsurance = { type: string; coverage: number; premium?: number; frequency?: Frequency };
export type EngineGoal = { name?: string; targetAmount: number; currentAmount: number; targetDate: string };

export type FinancialInput = {
  profile?: EngineProfile;
  income: EngineIncome[];
  expenses: EngineExpense[];
  investments: EngineInvestment[];
  loans: EngineLoan[];
  insurance?: EngineInsurance[];
  goals: EngineGoal[];
};

const clean = (n: number | null | undefined) => (Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export function toMonthly(amount: number, frequency: Frequency): number {
  const value = clean(amount);
  switch (frequency) {
    case "Weekly": return value * 52 / 12;
    case "Quarterly": return value / 3;
    case "Half-yearly": return value / 6;
    case "Yearly": return value / 12;
    default: return value;
  }
}

const essentialCategories = new Set([
  "Housing", "Food", "Transport", "Utilities", "Healthcare", "Insurance", "Education"
]);

function monthsUntil(dateValue: string) {
  if (!dateValue) return 0;
  const target = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(target.getTime())) return 0;
  const now = new Date();
  const months = (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth();
  return Math.max(0, months);
}

export function calculateFinancials(input: FinancialInput) {
  const monthlyIncome = sum(input.income.map((x) => toMonthly(x.amount, x.frequency)));
  const livingExpenses = sum(input.expenses.map((x) => toMonthly(x.amount, x.frequency)));
  const debtPayments = sum(input.loans.map((x) => clean(x.emi)));
  const investmentContributions = sum(input.investments.map((x) => clean(x.monthlyAmount)));
  const monthlyOutflow = livingExpenses + debtPayments + investmentContributions;
  const freeCashFlow = monthlyIncome - monthlyOutflow;
  const savingsRate = monthlyIncome > 0 ? freeCashFlow / monthlyIncome * 100 : 0;
  const investmentContributionRate = monthlyIncome > 0 ? investmentContributions / monthlyIncome * 100 : 0;
  const debtServiceRatio = monthlyIncome > 0 ? debtPayments / monthlyIncome * 100 : 0;

  const investedAmount = sum(input.investments.map((x) => clean(x.investedAmount)));
  const currentInvestmentValue = sum(input.investments.map((x) => clean(x.currentValue)));
  const investmentGainLoss = currentInvestmentValue - investedAmount;
  const outstandingDebt = sum(input.loans.map((x) => clean(x.outstanding)));

  const essentialExpenses = sum(
    input.expenses
      .filter((x) => essentialCategories.has(x.category))
      .map((x) => toMonthly(x.amount, x.frequency))
  );
  const essentialMonthlyExpenses = essentialExpenses + debtPayments;
  const emergencyFundTarget3Months = essentialMonthlyExpenses * 3;
  const emergencyFundTarget6Months = essentialMonthlyExpenses * 6;
  const cashSavings = clean(input.profile?.cashSavings);
  const emergencyCoverageMonths = essentialMonthlyExpenses > 0 ? cashSavings / essentialMonthlyExpenses : 0;

  const lifeCoverFromRecords = sum(
    (input.insurance ?? []).filter((x) => /life|term/i.test(x.type)).map((x) => clean(x.coverage))
  );
  const healthCoverFromRecords = sum(
    (input.insurance ?? []).filter((x) => /health|medical/i.test(x.type)).map((x) => clean(x.coverage))
  );
  const lifeCover = lifeCoverFromRecords || clean(input.profile?.lifeCover);
  const healthCover = healthCoverFromRecords || clean(input.profile?.healthCover);

  const goals = input.goals.map((goal) => {
    const remaining = Math.max(0, clean(goal.targetAmount) - clean(goal.currentAmount));
    const monthsRemaining = monthsUntil(goal.targetDate);
    const requiredMonthlyContribution = monthsRemaining > 0 ? remaining / monthsRemaining : remaining;
    const progress = clean(goal.targetAmount) > 0 ? clean(goal.currentAmount) / clean(goal.targetAmount) * 100 : 0;
    return {
      ...goal,
      remaining: round2(remaining),
      monthsRemaining,
      requiredMonthlyContribution: round2(requiredMonthlyContribution),
      progress: round2(Math.min(100, progress)),
    };
  });

  const assetAllocation = input.investments.reduce<Record<string, number>>((acc, item) => {
    const key = item.category || "Other";
    acc[key] = (acc[key] ?? 0) + clean(item.currentValue);
    return acc;
  }, {});

  const trackedNetWorth = currentInvestmentValue + cashSavings - outstandingDebt;
  const monthlyBaseline = livingExpenses + debtPayments;
  const projectedCashFlow = Array.from({ length: 12 }, (_, index) => {
    const month = new Date();
    month.setMonth(month.getMonth() + index + 1);
    return {
      month: month.toISOString().slice(0, 7),
      income: round2(monthlyIncome),
      baselineOutflow: round2(monthlyBaseline),
      investmentContributions: round2(investmentContributions),
      freeCashFlow: round2(freeCashFlow),
    };
  });

  const goalRequiredTotal = sum(goals.map((g) => g.requiredMonthlyContribution));
  const health = {
    cashFlow: freeCashFlow >= 0 ? "positive" : "negative",
    emergencyFund: emergencyCoverageMonths >= 6 ? "6+ months" : emergencyCoverageMonths >= 3 ? "3–6 months" : "below 3 months",
    debtLoad: debtServiceRatio <= 20 ? "lower" : debtServiceRatio <= 40 ? "moderate" : "higher",
    goalFunding: monthlyIncome > 0 && goalRequiredTotal <= Math.max(0, freeCashFlow) ? "covered" : "needs review",
  };

  return {
    monthlyIncome: round2(monthlyIncome),
    livingExpenses: round2(livingExpenses),
    debtPayments: round2(debtPayments),
    investmentContributions: round2(investmentContributions),
    monthlyOutflow: round2(monthlyOutflow),
    freeCashFlow: round2(freeCashFlow),
    savingsRate: round2(savingsRate),
    investmentContributionRate: round2(investmentContributionRate),
    debtServiceRatio: round2(debtServiceRatio),
    investedAmount: round2(investedAmount),
    currentInvestmentValue: round2(currentInvestmentValue),
    investmentGainLoss: round2(investmentGainLoss),
    investmentReturnPercent: investedAmount > 0 ? round2(investmentGainLoss / investedAmount * 100) : 0,
    outstandingDebt: round2(outstandingDebt),
    cashSavings: round2(cashSavings),
    trackedNetWorth: round2(trackedNetWorth),
    essentialMonthlyExpenses: round2(essentialMonthlyExpenses),
    emergencyFundTarget3Months: round2(emergencyFundTarget3Months),
    emergencyFundTarget6Months: round2(emergencyFundTarget6Months),
    emergencyCoverageMonths: round2(emergencyCoverageMonths),
    lifeCover: round2(lifeCover),
    healthCover: round2(healthCover),
    assetAllocation,
    goals,
    projectedCashFlow,
    health,
  };
}
