'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardHeader, CardContent } from '@/components/ui';

interface StageData {
  stage: string;
  count: number;
  color: string;
}

interface ApplicationsChartProps {
  data: StageData[];
}

const COLORS = {
  created: '#94a3b8',
  submitted: '#fef3c7',
  processing: '#dbeafe',
  approved: '#d1fae5',
  funded: '#d1fae5',
  declined: '#fee2e2',
  default: '#f1f5f9',
};

export function ApplicationsChart({ data }: ApplicationsChartProps) {
  const formattedData = data.map((item) => ({
    name: item.stage
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),
    value: item.count,
    color: COLORS[item.stage as keyof typeof COLORS] || COLORS.default,
  }));

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-[var(--color-text-primary)]">Applications by Stage</h2>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={formattedData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {formattedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

