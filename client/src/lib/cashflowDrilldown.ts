export type CashflowDrilldown = {
  entity: "japan" | "china" | "all";
  flowType: "income" | "expense";
  category: string;
  currency: "JPY" | "CNY";
  startDate: string;
  endDate: string;
  openReconciliation?: boolean;
};
