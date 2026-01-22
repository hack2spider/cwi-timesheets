"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface User {
  id: string;
  name: string;
  email: string;
  hourlyRate: number;
}

interface Project {
  id: string;
  name: string;
}

interface Timesheet {
  id: string;
  date: string;
  hoursWorked: number;
  notes: string | null;
  status: string;
  user: User;
  project: Project;
}

function getWeekDates(weekOffset: number = 0) {
  const now = new Date();
  now.setDate(now.getDate() + weekOffset * 7);

  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day);
  }

  return days;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit"
  });
}

function formatDayName(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short" });
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export default function TimesheetsSummaryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingCell, setEditingCell] = useState<{ userId: string; dateKey: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const weekDates = getWeekDates(weekOffset);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const isAdminOrSupervisor = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/operatives/login");
    } else if (status === "authenticated" && !isAdminOrSupervisor) {
      router.push("/operatives/dashboard");
    }
  }, [status, session, router, isAdminOrSupervisor]);

  useEffect(() => {
    if (status === "authenticated" && isAdminOrSupervisor) {
      fetchData();
    }
  }, [status, session, isAdminOrSupervisor]);

  const fetchData = async () => {
    try {
      const [timesheetsRes, usersRes, projectsRes] = await Promise.all([
        fetch("/api/admin/timesheets"),
        fetch("/api/admin/users"),
        fetch("/api/admin/projects"),
      ]);

      if (timesheetsRes.ok) {
        const data = await timesheetsRes.json();
        setTimesheets(data);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        // Get all operatives and supervisors (active and inactive for historical data)
        setUsers(data.filter((u: User & { role: string }) => u.role === "OPERATIVE" || u.role === "SUPERVISOR"));
      }
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data.filter((p: Project & { isActive: boolean }) => p.isActive));
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Build the weekly grid data - now stores timesheet IDs for editing
  const buildWeeklyGrid = () => {
    const grid: Record<string, Record<string, { hours: number; timesheetId: string | null }>> = {};

    // Initialize grid with all operatives
    users.forEach(user => {
      grid[user.id] = {};
      weekDates.forEach(date => {
        grid[user.id][date.toISOString().split("T")[0]] = { hours: 0, timesheetId: null };
      });
    });

    // Fill in timesheet data
    timesheets.forEach(ts => {
      const tsDate = new Date(ts.date);
      const dateKey = tsDate.toISOString().split("T")[0];

      // Check if this timesheet falls within the current week view
      if (tsDate >= weekStart && tsDate <= weekEnd) {
        if (!grid[ts.user.id]) {
          grid[ts.user.id] = {};
        }
        if (!grid[ts.user.id][dateKey]) {
          grid[ts.user.id][dateKey] = { hours: 0, timesheetId: null };
        }
        // Accumulate hours (in case of multiple entries per day)
        grid[ts.user.id][dateKey].hours += ts.hoursWorked;
        // Store the first timesheet ID for editing
        if (!grid[ts.user.id][dateKey].timesheetId) {
          grid[ts.user.id][dateKey].timesheetId = ts.id;
        }
      }
    });

    return grid;
  };

  const weeklyGrid = buildWeeklyGrid();

  // Calculate totals
  const calculateRowTotal = (userId: string): number => {
    if (!weeklyGrid[userId]) return 0;
    return Object.values(weeklyGrid[userId]).reduce((sum, cell) => sum + cell.hours, 0);
  };

  const calculateColumnTotal = (date: Date): number => {
    const dateKey = date.toISOString().split("T")[0];
    return Object.values(weeklyGrid).reduce((sum, userDays) => {
      return sum + (userDays[dateKey]?.hours || 0);
    }, 0);
  };

  const calculateGrandTotal = (): number => {
    return users.reduce((sum, user) => sum + calculateRowTotal(user.id), 0);
  };

  // Calculate costs
  const calculateRowCost = (userId: string): number => {
    const user = users.find(u => u.id === userId);
    if (!user) return 0;
    return calculateRowTotal(userId) * user.hourlyRate;
  };

  const calculateGrandTotalCost = (): number => {
    return users.reduce((sum, user) => sum + calculateRowCost(user.id), 0);
  };

  // Handle cell edit
  const handleCellClick = (userId: string, dateKey: string, currentHours: number) => {
    setEditingCell({ userId, dateKey });
    setEditValue(currentHours > 0 ? currentHours.toString() : "");
  };

  const handleEditSave = async () => {
    if (!editingCell || isSaving) return; // Prevent double-save

    const { userId, dateKey } = editingCell;
    const newHours = parseFloat(editValue) || 0;
    const cell = weeklyGrid[userId]?.[dateKey];

    // Don't save if no change or empty value for new cell
    if (!cell?.timesheetId && newHours === 0) {
      setEditingCell(null);
      setEditValue("");
      return;
    }

    setIsSaving(true);

    try {
      if (cell?.timesheetId && newHours > 0) {
        // Update existing timesheet
        const res = await fetch(`/api/admin/timesheets/${cell.timesheetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hoursWorked: newHours }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update timesheet");
        }
      } else if (cell?.timesheetId && newHours === 0) {
        // Delete timesheet if hours set to 0
        const res = await fetch(`/api/admin/timesheets/${cell.timesheetId}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to delete timesheet");
        }
      } else if (!cell?.timesheetId && newHours > 0) {
        // Create new timesheet
        const defaultProject = projects[0]; // Use first active project
        if (!defaultProject) {
          alert("No active projects available. Please create a project first.");
          setIsSaving(false);
          setEditingCell(null);
          setEditValue("");
          return;
        }

        console.log("Creating timesheet:", { userId, projectId: defaultProject.id, date: dateKey, hoursWorked: newHours });

        const res = await fetch("/api/admin/timesheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            projectId: defaultProject.id,
            date: dateKey,
            hoursWorked: newHours,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create timesheet");
        }
      }

      // Refresh data
      await fetchData();
    } catch (err) {
      console.error("Error saving timesheet:", err);
      alert(err instanceof Error ? err.message : "Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
      setEditingCell(null);
      setEditValue("");
    }
  };

  const handleEditCancel = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleEditSave();
    } else if (e.key === "Escape") {
      handleEditCancel();
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session || !isAdminOrSupervisor) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Timesheets Summary</h1>
        <Button variant="secondary" onClick={() => router.push("/admin")}>
          Back to Admin
        </Button>
      </div>

      {/* Week Navigation */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={() => setWeekOffset(weekOffset - 1)}>
            ← Previous Week
          </Button>

          <div className="text-center">
            <h2 className="text-lg font-semibold">
              Week: {formatDateShort(weekStart)} - {formatDateShort(weekEnd)}
            </h2>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="text-sm text-primary hover:underline mt-1"
              >
                Go to Current Week
              </button>
            )}
          </div>

          <Button variant="secondary" onClick={() => setWeekOffset(weekOffset + 1)}>
            Next Week →
          </Button>
        </div>
      </div>

      {/* Edit Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
        Click on any cell to edit hours. Press Enter to save or Escape to cancel.
      </div>

      {/* Weekly Timesheet Grid */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 border-r border-gray-300 min-w-[150px]">
                  Operative
                </th>
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 border-r border-gray-200 min-w-[70px]">
                  Rate/hr
                </th>
                {weekDates.map((date, idx) => (
                  <th
                    key={idx}
                    className={`px-3 py-3 text-center text-sm font-bold text-gray-900 min-w-[80px] ${
                      idx < 6 ? "border-r border-gray-200" : ""
                    } ${isSameDay(date, new Date()) ? "bg-blue-100" : ""}`}
                  >
                    <div>{formatDayName(date)}</div>
                    <div className="text-xs font-normal text-gray-600">
                      {formatDateShort(date)}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 bg-gray-200 min-w-[80px] border-r border-gray-300">
                  Total Hrs
                </th>
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 bg-green-100 min-w-[100px]">
                  Total Cost
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                    No operatives found.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const rowTotal = calculateRowTotal(user.id);
                  const rowCost = calculateRowCost(user.id);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200">
                        {user.name}
                      </td>
                      <td className="px-3 py-3 text-center text-sm text-gray-700 border-r border-gray-100">
                        £{user.hourlyRate.toFixed(2)}
                      </td>
                      {weekDates.map((date, idx) => {
                        const dateKey = date.toISOString().split("T")[0];
                        const cell = weeklyGrid[user.id]?.[dateKey];
                        const hours = cell?.hours || 0;
                        const isEditing = editingCell?.userId === user.id && editingCell?.dateKey === dateKey;

                        return (
                          <td
                            key={idx}
                            className={`px-2 py-2 text-center text-sm ${
                              idx < 6 ? "border-r border-gray-100" : ""
                            } ${isSameDay(date, new Date()) ? "bg-blue-50" : ""} ${
                              !isEditing ? "cursor-pointer hover:bg-yellow-50" : ""
                            }`}
                            onClick={() => !isEditing && handleCellClick(user.id, dateKey, hours)}
                          >
                            {isEditing ? (
                              <input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={handleEditSave}
                                autoFocus
                                min="0"
                                max="24"
                                step="0.5"
                                disabled={isSaving}
                                className="w-16 px-1 py-1 text-center border border-primary rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            ) : (
                              <span className={hours > 0 ? "font-semibold text-gray-900" : "text-gray-400"}>
                                {hours > 0 ? hours : "-"}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className={`px-3 py-3 text-center text-sm font-bold bg-gray-100 border-r border-gray-200 ${
                        rowTotal > 0 ? "text-gray-900" : "text-gray-400"
                      }`}>
                        {rowTotal > 0 ? rowTotal : 0}
                      </td>
                      <td className={`px-3 py-3 text-center text-sm font-bold bg-green-50 ${
                        rowCost > 0 ? "text-green-700" : "text-gray-400"
                      }`}>
                        £{rowCost.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-gray-200 border-t-2 border-gray-300">
              <tr>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 border-r border-gray-300">
                  Daily Total
                </td>
                <td className="px-3 py-3 text-center text-sm font-bold text-gray-700 border-r border-gray-300">
                  -
                </td>
                {weekDates.map((date, idx) => {
                  const colTotal = calculateColumnTotal(date);
                  return (
                    <td
                      key={idx}
                      className={`px-3 py-3 text-center text-sm font-bold text-gray-900 ${
                        idx < 6 ? "border-r border-gray-300" : ""
                      }`}
                    >
                      {colTotal > 0 ? colTotal : 0}
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-center text-sm font-bold text-gray-900 bg-gray-300 border-r border-gray-400">
                  {calculateGrandTotal()}
                </td>
                <td className="px-3 py-3 text-center text-sm font-bold text-green-800 bg-green-200">
                  £{calculateGrandTotalCost().toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary Info */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-gray-600">Total Operatives</p>
          <p className="text-2xl font-bold">{users.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-gray-600">Week Total Hours</p>
          <p className="text-2xl font-bold">{calculateGrandTotal()}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-gray-600">Week Total Cost</p>
          <p className="text-2xl font-bold text-green-600">£{calculateGrandTotalCost().toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-gray-600">Active Days</p>
          <p className="text-2xl font-bold">
            {weekDates.filter(d => calculateColumnTotal(d) > 0).length} / 7
          </p>
        </div>
      </div>
    </div>
  );
}
