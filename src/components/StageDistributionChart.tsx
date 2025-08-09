
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Activity } from 'lucide-react'

interface StageDistributionProps {
  data: Array<{
    stage: string
    count: number
    percentage: number
  }>
}

const COLORS = {
  'Normal': '#10B981',
  'Very_Mild_Dementia': '#F59E0B', 
  'Mild_Dementia': '#F97316',
  'Moderate_Dementia': '#EF4444'
}

const StageDistributionChart = ({ data }: StageDistributionProps) => {
  const chartData = data.map(item => ({
    name: item.stage.replace(/_/g, ' '),
    value: item.count,
    percentage: item.percentage,
    color: COLORS[item.stage as keyof typeof COLORS] || '#6B7280'
  }))

  return (
    <Card className="hover:shadow-xl transition-all duration-500 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border-white/30">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity className="h-5 w-5 mr-2 text-green-500" />
          Stage Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="value"
              label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: any, name: any) => [`${value} scans`, name]}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backdropFilter: 'blur(10px)'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export default StageDistributionChart
