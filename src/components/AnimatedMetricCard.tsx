
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'

interface AnimatedMetricCardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  alert?: boolean
  delay?: number
  className?: string
}

const AnimatedMetricCard = ({
  title,
  value,
  description,
  icon,
  trend,
  trendValue,
  alert,
  delay = 0,
  className
}: AnimatedMetricCardProps) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  return (
    <Card 
      className={cn(
        "relative overflow-hidden group hover:shadow-lg transition-all duration-500 hover:scale-105",
        "bg-gradient-to-br from-white/80 to-white/60 dark:from-gray-900/80 dark:to-gray-800/60 backdrop-blur-sm border-white/20 dark:border-gray-700/20",
        "transform transition-all duration-700 ease-out",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        className
      )}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 via-purple-400/10 to-pink-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Parallax effect overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-blue-50/20 dark:to-blue-900/20 transform group-hover:scale-110 transition-transform duration-700" />
      
      <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground dark:text-gray-400">
          {title}
        </CardTitle>
        <div className="flex items-center space-x-2">
          {alert && <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />}
          {icon && <div className="text-muted-foreground dark:text-gray-400 group-hover:text-primary transition-colors duration-300">{icon}</div>}
        </div>
      </CardHeader>
      
      <CardContent className="relative z-10">
        <div className="text-3xl font-bold mb-1 group-hover:text-primary dark:text-white transition-colors duration-300">
          {value}
        </div>
        
        <div className="flex items-center justify-between">
          {description && (
            <p className="text-xs text-muted-foreground dark:text-gray-400">{description}</p>
          )}
          
          {trend && trendValue && (
            <div className="flex items-center space-x-1">
              {getTrendIcon()}
              <span className={cn(
                "text-xs font-medium",
                trend === 'up' ? "text-green-600" : trend === 'down' ? "text-red-600" : "text-gray-600 dark:text-gray-400"
              )}>
                {trendValue}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default AnimatedMetricCard
