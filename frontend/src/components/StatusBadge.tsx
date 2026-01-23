import cn from "classnames";
import type { StatusType } from "../types/track";

const StatusBadge = ({ status }: { status: StatusType }) => {
  const styles: Record<StatusType, string> = {
    PENDING: "bg-gray-100 text-gray-700 border-gray-200",
    NEGOTIATING: "bg-blue-100 text-blue-700 border-blue-200",
    APPROVED: "bg-green-100 text-green-700 border-green-200",
    REJECTED: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-xs font-medium border",
      styles[status] || styles.PENDING
    )}>
      {status}
    </span>
  );
};

export default StatusBadge;