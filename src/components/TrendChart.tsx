
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { TrendingUp } from 'lucide-react'

interface TrendChartProps {
  data: Array<{
    visit: string
    confidence: number
    date: string
    stage: string
  }>
  title?: string
  description?: string
  gradient?: boolean
}

const TrendChart = ({ 
  data, 
  title = "Confidence Trend", 
  description = "Analysis confidence over time",
  gradient = true 
}: TrendChartProps) => {
  return (
    <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-500 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border-white/30">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      <CardHeader className="relative z-10">
        <CardTitle className="flex items-center text-lg font-semibold">
          <TrendingUp className="h-5 w-5 mr-2 text-blue-500" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      
      <CardContent className="relative z-10">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            {gradient ? (
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="visit" 
                  tick={{ fontSize: 12 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  tick={{ fontSize: 12 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <Tooltip 
                  formatter={(value: any) => [`${value.toFixed(1)}%`, 'Confidence']}
                  labelFormatter={(label: any) => {
                    const item = data.find(d => d.visit === label)
                    return `${label} - ${item?.date} (${item?.stage})`
                  }}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    backdropFilter: 'blur(10px)'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="confidence" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  fill="url(#confidenceGradient)"
                  dot={{ r: 5, fill: '#3B82F6', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 7, stroke: '#3B82F6', strokeWidth: 2 }}
                />
              </AreaChart>
            ) : (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="visit" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: any) => [`${value.toFixed(1)}%`, 'Confidence']}
                  labelFormatter={(label: any) => {
                    const item = data.find(d => d.visit === label)
                    return `${label} - ${item?.date} (${item?.stage})`
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="confidence" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#3B82F6' }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No scan data available for trend analysis</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default TrendChart
