'use client';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export interface AdminChartProps {
  type: 'line' | 'bar' | 'area';
  data: Array<Record<string, unknown>>;
  xKey?: string;
  yKey?: string;
  title?: string;
  color?: string;
  height?: number;
}

export function AdminChart({
  type,
  data,
  xKey = 'label',
  yKey = 'value',
  title,
  color = '#E50914',
  height = 240
}: AdminChartProps) {
  const ChartComponent = type === 'line' ? LineChart : type === 'bar' ? BarChart : AreaChart;

  return (
    <div className="bg-[#181818] border border-[#2A2A2A] rounded-lg p-5">
      {title && <h3 className="text-[13px] font-medium text-[#A3A3A3] mb-4">{title}</h3>}
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
            <XAxis 
              dataKey={xKey} 
              stroke="#A3A3A3" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis 
              stroke="#A3A3A3" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: '#202020', 
                border: '1px solid #2A2A2A',
                borderRadius: '8px',
                color: '#fff' 
              }}
              itemStyle={{ color: '#fff' }}
              cursor={{ fill: '#2A2A2A', opacity: 0.4 }}
            />
            
            {type === 'line' && (
              <Line 
                type="monotone" 
                dataKey={yKey} 
                stroke={color} 
                strokeWidth={2} 
                dot={{ fill: color, r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2 }} 
              />
            )}
            
            {type === 'bar' && (
              <Bar 
                dataKey={yKey} 
                fill={color} 
                radius={[4, 4, 0, 0]} 
              />
            )}
            
            {type === 'area' && (
              <>
                <defs>
                  <linearGradient id={`color${yKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey={yKey} 
                  stroke={color} 
                  fillOpacity={1} 
                  fill={`url(#color${yKey})`} 
                  strokeWidth={2}
                />
              </>
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
