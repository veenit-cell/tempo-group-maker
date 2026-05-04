import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { GroupWithMetaUrgency } from "@workspace/api-client-react";

interface DeadlineTimerProps {
  deadline: string;
  urgency: GroupWithMetaUrgency;
  className?: string;
  showIcon?: boolean;
}

export function DeadlineTimer({ deadline, urgency, className, showIcon = true }: DeadlineTimerProps) {
  const [timeLeft, setTimeLeft] = useState("");
  
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(deadline).getTime();
      const diff = end - now;
      
      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h left`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m left`);
      } else {
        setTimeLeft(`${minutes}m left`);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [deadline]);

  const urgencyClasses = {
    safe: "bg-[hsl(var(--safe))] text-[hsl(var(--safe-foreground))] hover:bg-[hsl(var(--safe))]/90",
    warning: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] hover:bg-[hsl(var(--warning))]/90",
    critical: "bg-[hsl(var(--critical))] text-[hsl(var(--critical-foreground))] animate-pulse hover:bg-[hsl(var(--critical))]/90",
    expired: "bg-[hsl(var(--expired))] text-[hsl(var(--expired-foreground))] hover:bg-[hsl(var(--expired))]/90",
  };

  return (
    <Badge className={cn("font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 px-2.5 py-1", urgencyClasses[urgency], className)}>
      {showIcon && <Clock className="h-3.5 w-3.5" />}
      {timeLeft}
    </Badge>
  );
}
