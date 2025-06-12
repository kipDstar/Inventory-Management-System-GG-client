// src/components/Chart.js
// Chart component for admin dashboard

import React from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend);

function Chart({ data, type = 'bar', options }) {
  if (!data) return <div>No data</div>;
  if (type === 'pie') return <Pie data={data} options={options} />;
  return <Bar data={data} options={options} />;
}

export default Chart;
