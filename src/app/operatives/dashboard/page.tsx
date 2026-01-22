"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getTodayDateString, formatDate, getStatusColor } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  location: string | null;
}

interface Timesheet {
  id: string;
  date: string;
  hoursWorked: number;
  notes: string | null;
  status: string;
  project: Project;
}

// Helper functions for calendar
function getMonthDates(monthOffset: number = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + monthOffset;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  return { firstDay, lastDay, year: firstDay.getFullYear(), month: firstDay.getMonth() };
}

function getMonthName(month: number): string {
  const months = ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"];
  return months[month];
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isFutureDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [recentTimesheets, setRecentTimesheets] = useState<Timesheet[]>([]);
  const [allTimesheets, setAllTimesheets] = useState<Timesheet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [monthOffset, setMonthOffset] = useState(0);

  const [formData, setFormData] = useState({
    projectId: "",
    date: getTodayDateString(),
    hoursWorked: "",
    notes: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/operatives/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchProjects();
      fetchRecentTimesheets();
    }
  }, [status]);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  };

  const fetchRecentTimesheets = async () => {
    try {
      const res = await fetch("/api/timesheets");
      if (res.ok) {
        const data = await res.json();
        setAllTimesheets(data);
        setRecentTimesheets(data.slice(0, 5));
      }
    } catch (err) {
      console.error("Failed to fetch timesheets:", err);
    }
  };

  // Build presence calendar data
  const buildCalendarData = () => {
    const { firstDay, lastDay, year, month } = getMonthDates(monthOffset);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

    // Create a set of dates with submitted timesheets
    const workedDates = new Set<string>();
    allTimesheets.forEach(ts => {
      const date = new Date(ts.date);
      if (date.getFullYear() === year && date.getMonth() === month) {
        workedDates.add(date.toISOString().split("T")[0]);
      }
    });

    // Build calendar grid
    const calendar: { date: Date | null; status: "present" | "absent" | "weekend" | "future" | "empty" }[][] = [];
    let week: { date: Date | null; status: "present" | "absent" | "weekend" | "future" | "empty" }[] = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      week.push({ date: null, status: "empty" });
    }

    // Add each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = date.toISOString().split("T")[0];

      let dayStatus: "present" | "absent" | "weekend" | "future" | "empty";

      if (isFutureDate(date)) {
        dayStatus = "future";
      } else if (isWeekend(date)) {
        dayStatus = "weekend";
      } else if (workedDates.has(dateKey)) {
        dayStatus = "present";
      } else {
        dayStatus = "absent";
      }

      week.push({ date, status: dayStatus });

      if (week.length === 7) {
        calendar.push(week);
        week = [];
      }
    }

    // Fill remaining days in the last week
    while (week.length > 0 && week.length < 7) {
      week.push({ date: null, status: "empty" });
    }
    if (week.length > 0) {
      calendar.push(week);
    }

    return { calendar, year, month, workedDates };
  };

  const { calendar, year, month, workedDates } = buildCalendarData();
  const totalWorkingDays = calendar.flat().filter(d => d.status === "present" || d.status === "absent").length;
  const totalPresent = calendar.flat().filter(d => d.status === "present").length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit timesheet");
      } else {
        setSuccess("Timesheet submitted successfully!");
        setFormData({
          projectId: "",
          date: getTodayDateString(),
          hoursWorked: "",
          notes: "",
        });
        fetchRecentTimesheets();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Welcome, {session.user.name}</h1>
      <p className="text-muted mb-8">Submit your daily hours below</p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Timesheet Entry Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Submit Hours</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-error rounded-md">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-success rounded-md">
              <p className="text-sm text-success">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="date"
              type="date"
              label="Date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              max={getTodayDateString()}
            />

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="project">
                Project
              </label>
              <select
                id="project"
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} {project.location && `(${project.location})`}
                  </option>
                ))}
              </select>
            </div>

            <Input
              id="hours"
              type="number"
              label="Hours Worked"
              value={formData.hoursWorked}
              onChange={(e) => setFormData({ ...formData, hoursWorked: e.target.value })}
              required
              min="0.5"
              max="24"
              step="0.5"
              placeholder="e.g., 8"
            />

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="notes">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={3}
                placeholder="Any additional notes..."
              />
            </div>

            <Button type="submit" isLoading={isLoading} className="w-full">
              Submit Hours
            </Button>
          </form>
        </div>

        {/* Recent Submissions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Submissions</h2>

          {recentTimesheets.length === 0 ? (
            <p className="text-muted">No timesheets submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {recentTimesheets.map((ts) => (
                <div key={ts.id} className="border border-border rounded-md p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{ts.project.name}</p>
                      <p className="text-sm text-muted">{formatDate(ts.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{ts.hoursWorked}h</p>
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded-full ${getStatusColor(
                          ts.status
                        )}`}
                      >
                        {ts.status}
                      </span>
                    </div>
                  </div>
                  {ts.notes && (
                    <p className="text-sm text-muted mt-2 italic">{ts.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <Button
            variant="secondary"
            onClick={() => router.push("/operatives/timesheets")}
            className="w-full mt-4"
          >
            View All Timesheets
          </Button>
        </div>
      </div>

      {/* Monthly Presence Calendar */}
      <div className="mt-8 bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Monthly Presence</h2>
          <div className="flex items-center space-x-4">
            <Button variant="secondary" onClick={() => setMonthOffset(monthOffset - 1)} className="text-sm px-3 py-1">
              ← Prev
            </Button>
            <span className="font-medium">{getMonthName(month)} {year}</span>
            <Button
              variant="secondary"
              onClick={() => setMonthOffset(monthOffset + 1)}
              className="text-sm px-3 py-1"
              disabled={monthOffset >= 0}
            >
              Next →
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-6 mb-4 text-sm">
          <div className="flex items-center">
            <span className="w-4 h-4 bg-green-500 rounded mr-2"></span>
            <span>Present</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 bg-red-500 rounded mr-2"></span>
            <span>Absent</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 bg-gray-200 rounded mr-2"></span>
            <span>Weekend/Future</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <th key={day} className="px-2 py-2 text-center text-sm font-semibold text-gray-700 border border-gray-200">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendar.map((week, weekIdx) => (
                <tr key={weekIdx}>
                  {week.map((day, dayIdx) => {
                    const today = new Date();
                    const isToday = day.date && isSameDay(day.date, today);

                    let bgColor = "";
                    if (day.status === "present") bgColor = "bg-green-500 text-white";
                    else if (day.status === "absent") bgColor = "bg-red-500 text-white";
                    else if (day.status === "weekend" || day.status === "future") bgColor = "bg-gray-100 text-gray-400";
                    else bgColor = "bg-white";

                    return (
                      <td
                        key={dayIdx}
                        className={`px-2 py-3 text-center border border-gray-200 ${bgColor} ${
                          isToday ? "ring-2 ring-primary ring-inset" : ""
                        }`}
                      >
                        {day.date ? (
                          <span className="text-sm font-medium">{day.date.getDate()}</span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <div>
            <span className="text-muted">Working Days: </span>
            <span className="font-semibold">{totalWorkingDays}</span>
          </div>
          <div>
            <span className="text-muted">Days Present: </span>
            <span className="font-semibold text-green-600">{totalPresent}</span>
          </div>
          <div>
            <span className="text-muted">Days Absent: </span>
            <span className="font-semibold text-red-600">{totalWorkingDays - totalPresent}</span>
          </div>
          <div>
            <span className="text-muted">Attendance: </span>
            <span className="font-semibold">
              {totalWorkingDays > 0 ? Math.round((totalPresent / totalWorkingDays) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
