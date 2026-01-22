"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { formatDate, getStatusColor } from "@/lib/utils";

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
  createdAt: string;
}

export default function TimesheetsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/operatives/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchTimesheets();
    }
  }, [status]);

  const fetchTimesheets = async () => {
    try {
      const res = await fetch("/api/timesheets");
      if (res.ok) {
        const data = await res.json();
        setTimesheets(data);
      }
    } catch (err) {
      console.error("Failed to fetch timesheets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const totalHours = timesheets.reduce((sum, ts) => sum + ts.hoursWorked, 0);
  const approvedHours = timesheets
    .filter((ts) => ts.status === "APPROVED")
    .reduce((sum, ts) => sum + ts.hoursWorked, 0);
  const pendingHours = timesheets
    .filter((ts) => ts.status === "PENDING")
    .reduce((sum, ts) => sum + ts.hoursWorked, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Timesheets</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-muted">Total Hours</p>
          <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-muted">Approved Hours</p>
          <p className="text-2xl font-bold text-success">{approvedHours.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-muted">Pending Hours</p>
          <p className="text-2xl font-bold text-accent">{pendingHours.toFixed(1)}</p>
        </div>
      </div>

      {/* Timesheets Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {timesheets.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted">No timesheets found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Project</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Hours</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Notes</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {timesheets.map((ts) => (
                  <tr key={ts.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{formatDate(ts.date)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">{ts.project.name}</span>
                      {ts.project.location && (
                        <span className="text-muted block text-xs">{ts.project.location}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">{ts.hoursWorked}h</td>
                    <td className="px-4 py-3 text-sm text-muted max-w-xs truncate">
                      {ts.notes || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(
                          ts.status
                        )}`}
                      >
                        {ts.status}
                      </span>
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
