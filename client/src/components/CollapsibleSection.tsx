import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface CollapsibleSectionProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  summary?: string;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  className?: string;
  headerClassName?: string;
  accentColor?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  icon,
  badge,
  summary,
  defaultOpen = false,
  isOpen,
  onToggle,
  className = "",
  headerClassName = "",
  accentColor = "text-gray-400",
  children,
  headerRight,
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const handleToggle = onToggle || (() => setInternalOpen(!internalOpen));

  return (
    <Collapsible open={open} onOpenChange={handleToggle}>
      <div className={className}>
        <CollapsibleTrigger asChild>
          <div className={`flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity select-none ${headerClassName}`}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {icon}
              <span className="text-lg font-bold text-white truncate">{title}</span>
              {badge}
              {!open && summary && (
                <span className="text-xs text-gray-400 ml-2 truncate hidden sm:inline">
                  {summary}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {headerRight && open && <div onClick={(e) => e.stopPropagation()}>{headerRight}</div>}
              <ChevronDown
                className={`h-5 w-5 ${accentColor} transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-4">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
