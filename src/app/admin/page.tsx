"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate, getStatusColor } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  isActive?: boolean;
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

interface Stats {
  totalUsers: number;
  totalProjects: number;
  pendingTimesheets: number;
  totalHoursThisMonth: number;
}

interface OperativePresence {
  id: string;
  name: string;
  monthlyHours: number;
  daysPresent: number;
  totalWorkingDays: number;
  presencePercentage: number;
}

// Helper functions
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

function countWorkingDaysInMonth(year: number, month: number): number {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let count = 0;
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    if (!isWeekend(d) && d <= today) {
      count++;
    }
  }
  return count;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingTimesheets, setPendingTimesheets] = useState<Timesheet[]>([]);
  const [allTimesheets, setAllTimesheets] = useState<Timesheet[]>([]);
  const [operatives, setOperatives] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);

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
      fetchAdminData();
    }
  }, [status, session, isAdminOrSupervisor]);

  // Refresh data when page becomes visible (e.g., after navigating back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && status === "authenticated" && isAdminOrSupervisor) {
        fetchAdminData();
      }
    };

    const handleFocus = () => {
      if (status === "authenticated" && isAdminOrSupervisor) {
        fetchAdminData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [status, isAdminOrSupervisor]);

  const fetchAdminData = async () => {
    try {
      const [statsRes, pendingRes, allTimesheetsRes, usersRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/timesheets?status=PENDING"),
        fetch("/api/admin/timesheets"),
        fetch("/api/admin/users"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (pendingRes.ok) {
        const timesheetsData = await pendingRes.json();
        setPendingTimesheets(timesheetsData.slice(0, 10));
      }

      if (allTimesheetsRes.ok) {
        const data = await allTimesheetsRes.json();
        setAllTimesheets(data);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setOperatives(data.filter((u: User) => (u.role === "OPERATIVE" || u.role === "SUPERVISOR") && u.isActive));
      }
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate presence data for each operative
  const calculatePresenceData = (): OperativePresence[] => {
    const { year, month } = getMonthDates(monthOffset);
    const workingDays = countWorkingDaysInMonth(year, month);

    return operatives.map(operative => {
      // Get all timesheets for this operative in the selected month
      const operativeTimesheets = allTimesheets.filter(ts => {
        const tsDate = new Date(ts.date);
        return ts.user.id === operative.id &&
               tsDate.getFullYear() === year &&
               tsDate.getMonth() === month;
      });

      // Calculate unique days worked
      const workedDates = new Set<string>();
      let totalHours = 0;

      operativeTimesheets.forEach(ts => {
        const dateKey = new Date(ts.date).toISOString().split("T")[0];
        workedDates.add(dateKey);
        totalHours += ts.hoursWorked;
      });

      const daysPresent = workedDates.size;
      const presencePercentage = workingDays > 0 ? Math.round((daysPresent / workingDays) * 100) : 0;

      return {
        id: operative.id,
        name: operative.name,
        monthlyHours: totalHours,
        daysPresent,
        totalWorkingDays: workingDays,
        presencePercentage,
      };
    }).sort((a, b) => b.monthlyHours - a.monthlyHours); // Sort by hours descending
  };

  const presenceData = calculatePresenceData();
  const maxHours = Math.max(...presenceData.map(p => p.monthlyHours), 1);
  const { year, month } = getMonthDates(monthOffset);

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/timesheets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });

      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error("Failed to approve timesheet:", err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/timesheets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      });

      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error("Failed to reject timesheet:", err);
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
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-muted">Total Operatives</p>
          <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-muted">Active Projects</p>
          <p className="text-2xl font-bold">{stats?.totalProjects || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-muted">Pending Approvals</p>
          <p className="text-2xl font-bold text-accent">{stats?.pendingTimesheets || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-muted">Hours This Month</p>
          <p className="text-2xl font-bold">{stats?.totalHoursThisMonth?.toFixed(1) || 0}</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link
          href="/admin/users"
          className="bg-primary text-white rounded-lg shadow-md p-6 hover:bg-primary-hover transition-colors"
        >
          <h2 className="text-xl font-semibold mb-2">Manage Operatives</h2>
          <p className="text-sm opacity-80">Add, edit, or deactivate operative accounts</p>
        </Link>
        <Link
          href="/admin/projects"
          className="bg-accent text-white rounded-lg shadow-md p-6 hover:bg-accent-hover transition-colors"
        >
          <h2 className="text-xl font-semibold mb-2">Manage Projects</h2>
          <p className="text-sm opacity-80">Add, edit, or deactivate projects</p>
        </Link>
        <Link
          href="/admin/timesheets"
          className="bg-green-600 text-white rounded-lg shadow-md p-6 hover:bg-green-700 transition-colors"
        >
          <h2 className="text-xl font-semibold mb-2">Timesheets Summary</h2>
          <p className="text-sm opacity-80">View all timesheets by operative, project, and date</p>
        </Link>
        {session?.user?.role === "ADMIN" && (
          <Link
            href="/admin/supervisor-assignments"
            className="bg-purple-600 text-white rounded-lg shadow-md p-6 hover:bg-purple-700 transition-colors"
          >
            <h2 className="text-xl font-semibold mb-2">Supervisor Access</h2>
            <p className="text-sm opacity-80">Assign supervisors to specific projects</p>
          </Link>
        )}
      </div>

      {/* Monthly Presence & Hours Chart */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Monthly Presence & Hours</h2>
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

        {presenceData.length === 0 ? (
          <p className="text-muted text-center py-8">No operatives found.</p>
        ) : (
          <div className="space-y-4">
            {/* Hours Bar Chart */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Hours Worked</h3>
              <div className="space-y-3">
                {presenceData.map((operative) => (
                  <div key={operative.id} className="flex items-center">
                    <div className="w-32 text-sm font-medium truncate" title={operative.name}>
                      {operative.name}
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="h-8 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                          style={{ width: `${Math.max((operative.monthlyHours / maxHours) * 100, 5)}%` }}
                        >
                          <span className="text-xs text-white font-semibold">
                            {operative.monthlyHours > 0 ? `${operative.monthlyHours}h` : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-16 text-right text-sm font-semibold">
                      {operative.monthlyHours}h
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Presence Summary Table */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Presence Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">Operative</th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-900">Days Present</th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-900">Working Days</th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-900">Attendance</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">Total Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {presenceData.map((operative) => (
                      <tr key={operative.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{operative.name}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className="text-green-600 font-semibold">{operative.daysPresent}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">{operative.totalWorkingDays}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center">
                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
                              <div
                                className={`h-full rounded-full ${
                                  operative.presencePercentage >= 80 ? "bg-green-500" :
                                  operative.presencePercentage >= 50 ? "bg-yellow-500" : "bg-red-500"
                                }`}
                                style={{ width: `${operative.presencePercentage}%` }}
                              />
                            </div>
                            <span className={`text-sm font-semibold ${
                              operative.presencePercentage >= 80 ? "text-green-600" :
                              operative.presencePercentage >= 50 ? "text-yellow-600" : "text-red-600"
                            }`}>
                              {operative.presencePercentage}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">{operative.monthlyHours}h</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                    <tr>
                      <td className="px-4 py-3 text-sm font-bold">Total</td>
                      <td className="px-4 py-3 text-sm text-center font-bold">
                        {presenceData.reduce((sum, p) => sum + p.daysPresent, 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">-</td>
                      <td className="px-4 py-3 text-sm text-center">-</td>
                      <td className="px-4 py-3 text-sm text-right font-bold">
                        {presenceData.reduce((sum, p) => sum + p.monthlyHours, 0)}h
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pending Timesheets */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-xl font-semibold">Pending Timesheets</h2>
        </div>

        {pendingTimesheets.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted">No pending timesheets to review.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Operative</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Project</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Hours</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Notes</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingTimesheets.map((ts) => (
                  <tr key={ts.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">{ts.user.name}</span>
                      <span className="text-muted block text-xs">{ts.user.email}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatDate(ts.date)}</td>
                    <td className="px-4 py-3 text-sm">{ts.project.name}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{ts.hoursWorked}h</td>
                    <td className="px-4 py-3 text-sm text-muted max-w-xs truncate">
                      {ts.notes || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleApprove(ts.id)}
                          className="text-xs px-2 py-1 bg-success hover:bg-green-700"
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => handleReject(ts.id)}
                          className="text-xs px-2 py-1"
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
