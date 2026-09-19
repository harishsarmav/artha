export type Income = {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
};

export type Expense = {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
};

export type Investment = {
  id: string;
  name: string;
  type: string;
  category: string;
  mode: string;
  monthlyAmount: number;
  investedAmount: number;
  currentValue: number;
  startDate: string;
};

export type Loan = {
  id: string;
  name: string;
  type: string;
  originalAmount: number;
  outstanding: number;
  emi: number;
  interestRate: number;
  tenureMonths: number;
};

export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
};

export const monthly = (amount: number, frequency: string) => {
  switch (frequency) {
    case "Weekly":
      return amount * (52 / 12);
    case "Quarterly":
      return amount / 3;
    case "Half-yearly":
      return amount / 6;
    case "Yearly":
      return amount / 12;
    default:
      return amount;
  }
};

export const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function context(input: {
  income: Income[];
  expenses: Expense[];
  investments: Investment[];
  loans: Loan[];
  goals: Goal[];
  profile: any;
}) {
  const monthlyIncome = sum(
    input.income.map((item) => monthly(item.amount, item.frequency))
  );

  const monthlyExpenses = sum(
    input.expenses.map((item) => monthly(item.amount, item.frequency))
  );

  const monthlyEmi = sum(input.loans.map((item) => item.emi));
  const monthlyOutflow = monthlyExpenses + monthlyEmi;
  const monthlySurplus = monthlyIncome - monthlyOutflow;

  const currentInvestmentValue = sum(
    input.investments.map((item) => item.currentValue)
  );

  const investedAmount = sum(
    input.investments.map((item) => item.investedAmount)
  );

  return {
    income: {
      monthly: Math.round(monthlyIncome),
      sources: input.income.length,
      details: input.income.map((item) => ({
        name: item.name,
        type: item.type,
        monthlyAmount: Math.round(monthly(item.amount, item.frequency)),
      })),
    },
    expenses: {
      monthly: Math.round(monthlyExpenses),
      details: input.expenses.map((item) => ({
        name: item.name,
        category: item.category || "Other",
        monthlyAmount: Math.round(monthly(item.amount, item.frequency)),
      })),
    },
    cashFlow: {
      monthlyOutflow: Math.round(monthlyOutflow),
      monthlySurplus: Math.round(monthlySurplus),
      savingsRate: monthlyIncome
        ? Number(((monthlySurplus / monthlyIncome) * 100).toFixed(1))
        : 0,
    },
    investments: {
      currentValue: Math.round(currentInvestmentValue),
      investedAmount: Math.round(investedAmount),
      gain: Math.round(currentInvestmentValue - investedAmount),
      count: input.investments.length,
      details: input.investments.map((item) => ({
        name: item.name,
        type: item.type,
        category: item.category,
        mode: item.mode,
        monthlySIP: item.monthlyAmount,
        investedAmount: item.investedAmount,
        currentValue: item.currentValue,
      })),
    },
    debt: {
      outstanding: Math.round(
        sum(input.loans.map((item) => item.outstanding))
      ),
      monthlyEmi: Math.round(monthlyEmi),
      count: input.loans.length,
      details: input.loans.map((item) => ({
        name: item.name,
        type: item.type,
        originalAmount: item.originalAmount,
        outstanding: item.outstanding,
        monthlyEmi: item.emi,
        interestRate: item.interestRate,
        tenureMonths: item.tenureMonths,
      })),
    },
    insurance: {
      lifeCover: input.profile.lifeCover || 0,
      healthCover: input.profile.healthCover || 0,
    },
    goals: input.goals.map((goal) => ({
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      targetDate: goal.targetDate,
      progress: goal.targetAmount
        ? Number(((goal.currentAmount / goal.targetAmount) * 100).toFixed(1))
        : 0,
    })),
    profile: {
      name: input.profile.name,
      age: input.profile.age,
      dependents: input.profile.dependents,
      goal: input.profile.goal,
      risk: input.profile.risk,
      horizon: input.profile.horizon,
    },
  };
}
