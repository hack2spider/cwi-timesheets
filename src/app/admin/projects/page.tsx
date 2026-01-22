"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  location: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    timesheets: number;
  };
}

export default function ManageProjectsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    location: "",
  });

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
      fetchProjects();
    }
  }, [status, session, isAdminOrSupervisor]);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/admin/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create project");
      } else {
        setSuccess("Project created successfully!");
        setFormData({ name: "", location: "" });
        setShowForm(false);
        fetchProjects();
      }
    } catch {
      setError("An error occurred. Please try again.");
    }
  };

  const toggleProjectActive = async (projectId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (res.ok) {
        fetchProjects();
      }
    } catch (err) {
      console.error("Failed to update project:", err);
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Projects</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add New Project"}
        </Button>
      </div>

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

      {/* Add Project Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Add New Project</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                id="name"
                label="Project Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Project Name"
              />
              <Input
                id="location"
                label="Location (optional)"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="City, Address, etc."
              />
            </div>
            <Button type="submit" className="w-full md:w-auto">
              Create Project
            </Button>
          </form>
        </div>
      )}

      {/* Projects Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {projects.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted">No projects found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Timesheets</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{project.name}</td>
                    <td className="px-4 py-3 text-sm text-muted">{project.location || "-"}</td>
                    <td className="px-4 py-3 text-sm">{project._count?.timesheets || 0}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded-full ${
                          project.isActive
                            ? "bg-green-50 text-success"
                            : "bg-red-50 text-error"
                        }`}
                      >
                        {project.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{formatDate(project.createdAt)}</td>
                    <td className="px-4 py-3 text-sm">
                      <Button
                        variant={project.isActive ? "danger" : "primary"}
                        onClick={() => toggleProjectActive(project.id, project.isActive)}
                        className="text-xs px-2 py-1"
                      >
                        {project.isActive ? "Deactivate" : "Activate"}
                      </Button>
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
