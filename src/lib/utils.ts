export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "APPROVED":
      return "text-success bg-green-50";
    case "REJECTED":
      return "text-error bg-red-50";
    case "PENDING":
    default:
      return "text-accent bg-amber-50";
  }
}
