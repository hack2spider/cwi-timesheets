"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Project {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  user: User;
  project: Project;
  assignedAt: string;
}

export default function SupervisorAssignmentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedSupervisor, setSelectedSupervisor] = useState("");
  const [selectedProject, setSelectedProject] = useState("");

  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/operatives/login");
    } else if (status === "authenticated" && !isAdmin) {
      router.push("/admin");
    }
  }, [status, session, router, isAdmin]);

  useEffect(() => {
    if (status === "authenticated" && isAdmin) {
      fetchData();
    }
  }, [status, isAdmin]);

  const fetchData = async () => {
    try {
      const [assignmentsRes, usersRes, projectsRes] = await Promise.all([
        fetch("/api/admin/supervisor-projects"),
        fetch("/api/admin/users"),
        fetch("/api/admin/projects"),
      ]);

      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json();
        setAssignments(data);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setSupervisors(data.filter((u: User) => u.role === "SUPERVISOR"));
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

  const handleAssign = async () => {
    if (!selectedSupervisor || !selectedProject) {
      setError("Please select both a supervisor and a project");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/supervisor-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedSupervisor,
          projectId: selectedProject,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to assign supervisor");
      } else {
        setSuccess("Supervisor assigned successfully!");
        setSelectedSupervisor("");
        setSelectedProject("");
        fetchData();
      }
    } catch {
      setError("An error occurred. Please try again.");
    }
  };

  const handleRemove = async (userId: string, projectId: string, supervisorName: string, projectName: string) => {
    if (!confirm(`Remove ${supervisorName} from ${projectName}?`)) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/supervisor-projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, projectId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to remove assignment");
      } else {
        setSuccess("Assignment removed successfully!");
        fetchData();
      }
    } catch {
      setError("An error occurred. Please try again.");
    }
  };

  // Group assignments by supervisor
  const groupedAssignments = supervisors.map(supervisor => ({
    supervisor,
    projects: assignments
      .filter(a => a.user.id === supervisor.id)
      .map(a => a.project),
  }));

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Supervisor Project Assignments</h1>
        <Button variant="secondary" onClick={() => router.push("/admin")}>
          Back to Admin
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {/* Assign New */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Assign Supervisor to Project</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Supervisor</label>
            <select
              value={selectedSupervisor}
              onChange={(e) => setSelectedSupervisor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select supervisor...</option>
              {supervisors.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleAssign}>Assign</Button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          Supervisors can only edit timesheets for projects they are assigned to. Admins can edit all projects.
        </p>
      </div>

      {/* Current Assignments */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Current Assignments</h2>
        </div>

        {groupedAssignments.length === 0 || groupedAssignments.every(g => g.projects.length === 0) ? (
          <div className="p-8 text-center text-gray-500">
            No supervisors assigned to projects yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {groupedAssignments.map(({ supervisor, projects: assignedProjects }) => (
              assignedProjects.length > 0 && (
                <div key={supervisor.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-gray-900">{supervisor.name}</span>
                      <span className="text-sm text-gray-500 ml-2">({supervisor.email})</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {assignedProjects.map(project => (
                      <span
                        key={project.id}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                      >
                        {project.name}
                        <button
                          onClick={() => handleRemove(supervisor.id, project.id, supervisor.name, project.name)}
                          className="ml-2 text-blue-600 hover:text-red-600"
                          title="Remove assignment"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Supervisors with no project assignments cannot edit any timesheets</li>
          <li>• Supervisors can only edit timesheets for their assigned projects</li>
          <li>• Admins can edit timesheets for all projects regardless of assignments</li>
          <li>• A supervisor can be assigned to multiple projects</li>
        </ul>
      </div>
    </div>
  );
}
