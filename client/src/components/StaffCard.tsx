import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Mail, Phone, MapPin, Briefcase, Calendar, 
  Building2, Tag 
} from "lucide-react";

export interface StaffCardData {
  id: number;
  name: string;
  nameEn?: string | null;
  email: string;
  phone?: string | null;
  department?: string | null;
  position?: string | null;
  country?: string | null;
  avatarUrl?: string | null;
  joinDate?: Date | string | null;
  skills?: string[] | null;
  employmentType?: string | null;
  isActive: string;
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  fulltime: "正社員",
  parttime: "パート",
  contract: "契約社員",
  intern: "インターン",
};

const EMPLOYMENT_TYPE_COLORS: Record<string, string> = {
  fulltime: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  parttime: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  contract: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  intern: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

function getInitials(name: string): string {
  const parts = name.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-rose-500", "bg-pink-500", "bg-fuchsia-500", "bg-purple-500",
    "bg-violet-500", "bg-indigo-500", "bg-blue-500", "bg-sky-500",
    "bg-cyan-500", "bg-teal-500", "bg-emerald-500", "bg-green-500",
    "bg-lime-500", "bg-yellow-500", "bg-amber-500", "bg-orange-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

interface StaffCardProps {
  staff: StaffCardData;
  onClick?: (staff: StaffCardData) => void;
  compact?: boolean;
}

export default function StaffCard({ staff, onClick, compact = false }: StaffCardProps) {
  const avatarColor = getAvatarColor(staff.name);
  const initials = getInitials(staff.name);
  const employmentLabel = EMPLOYMENT_TYPE_LABELS[staff.employmentType || "fulltime"] || "正社員";
  const employmentColor = EMPLOYMENT_TYPE_COLORS[staff.employmentType || "fulltime"] || EMPLOYMENT_TYPE_COLORS.fulltime;

  if (compact) {
    return (
      <Card 
        className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 ${
          staff.isActive !== "active" ? "opacity-60" : ""
        }`}
        onClick={() => onClick?.(staff)}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={staff.avatarUrl || undefined} alt={staff.name} />
              <AvatarFallback className={`${avatarColor} text-white text-sm font-medium`}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{staff.name}</p>
                {staff.isActive !== "active" && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">退職</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {staff.position || staff.department || staff.email}
              </p>
            </div>
            {staff.country && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                {staff.country}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 ${
        staff.isActive !== "active" ? "opacity-60" : ""
      }`}
      onClick={() => onClick?.(staff)}
    >
      <CardContent className="p-5">
        {/* Header: Avatar + Name + Status */}
        <div className="flex items-start gap-4 mb-4">
          <Avatar className="h-14 w-14 shrink-0 ring-2 ring-background shadow-sm">
            <AvatarImage src={staff.avatarUrl || undefined} alt={staff.name} />
            <AvatarFallback className={`${avatarColor} text-white text-lg font-semibold`}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base truncate">{staff.name}</h3>
              {staff.isActive === "active" ? (
                <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                  在籍
                </span>
              ) : (
                <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  退職
                </span>
              )}
            </div>
            {staff.nameEn && (
              <p className="text-xs text-muted-foreground mt-0.5">{staff.nameEn}</p>
            )}
            {staff.position && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {staff.position}
              </p>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="space-y-2 text-sm">
          {staff.department && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{staff.department}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{staff.email}</span>
          </div>
          {staff.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{staff.phone}</span>
            </div>
          )}
          {staff.country && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{staff.country}</span>
            </div>
          )}
          {staff.joinDate && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>{formatDate(staff.joinDate)} 入社</span>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium ${employmentColor}`}>
            {employmentLabel}
          </span>
          {staff.skills && staff.skills.length > 0 && (
            <>
              {staff.skills.slice(0, 3).map((skill, i) => (
                <span 
                  key={i} 
                  className="inline-flex items-center gap-0.5 h-5 px-2 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {skill}
                </span>
              ))}
              {staff.skills.length > 3 && (
                <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  +{staff.skills.length - 3}
                </span>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
