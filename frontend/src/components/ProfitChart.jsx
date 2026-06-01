import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function ProfitChart({ data }) {
  const chartData = data.map((entry, index) => ({
    tx: index + 1,
    profit: entry.profit,
  })).reverse();

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Profit History</h3>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="#334155" />
            <XAxis dataKey="tx" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Line type="monotone" dataKey="profit" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
