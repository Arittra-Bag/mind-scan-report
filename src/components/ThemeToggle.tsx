
import React from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  className, 
  variant = 'outline', 
  size = 'icon' 
}) => {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        "hover:scale-105 hover:shadow-lg",
        "dark:border-gray-700 dark:hover:bg-gray-800",
        className
      )}
    >
      <Sun className={cn(
        "h-4 w-4 transition-all duration-500 rotate-0 scale-100",
        theme === 'dark' && "-rotate-90 scale-0"
      )} />
      <Moon className={cn(
        "absolute h-4 w-4 transition-all duration-500 rotate-90 scale-0",
        theme === 'dark' && "rotate-0 scale-100"
      )} />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

export default ThemeToggle
