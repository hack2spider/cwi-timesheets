"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  hourlyRate: number;
  isActive: boolean;
  createdAt: string;
}

export default function ManageUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    hourlyRate: "20",
    role: "OPERATIVE" as "ADMIN" | "SUPERVISOR" | "OPERATIVE",
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
      fetchUsers();
    }
  }, [status, session, isAdminOrSupervisor]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create user");
      } else {
        setSuccess("User created successfully!");
        setFormData({ name: "", email: "", password: "", hourlyRate: "20", role: "OPERATIVE" });
        setShowForm(false);
        fetchUsers();
      }
    } catch {
      setError("An error occurred. Please try again.");
    }
  };

  const toggleUserActive = async (userId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error("Failed to update user:", err);
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete "${userName}"? This will also delete all their timesheets. This action cannot be undone.`)) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to delete user");
      } else {
        setSuccess(`User "${userName}" deleted successfully`);
        fetchUsers();
      }
    } catch (err) {
      console.error("Failed to delete user:", err);
      setError("An error occurred while deleting the user");
    }
  };

  // Filter users based on search query
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <h1 className="text-2xl font-bold">Manage Users</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add New User"}
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

      {/* Add User Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Add New User</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                id="name"
                label="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="John Smith"
              />
              <Input
                id="email"
                type="email"
                label="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="john.smith@cwi-facades.co.uk"
              />
              <Input
                id="password"
                type="password"
                label="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                placeholder="Minimum 6 characters"
              />
              <Input
                id="hourlyRate"
                type="number"
                label="Hourly Rate (GBP)"
                value={formData.hourlyRate}
                onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                required
                min="0"
                step="0.5"
              />
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="role">
                  Role
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as "ADMIN" | "SUPERVISOR" | "OPERATIVE" })}
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                >
                  <option value="OPERATIVE">Operative</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <Button type="submit" className="w-full md:w-auto">
              Create User
            </Button>
          </form>
        </div>
      )}

      {/* Search Box */}
      <div className="mb-4">
        <Input
          id="search"
          type="text"
          placeholder="Search by name, email, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted">
              {searchQuery ? `No users found matching "${searchQuery}"` : "No users found."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Hourly Rate</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-sm">{user.email}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded-full ${
                          user.role === "ADMIN"
                            ? "bg-primary text-white"
                            : user.role === "SUPERVISOR"
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">£{user.hourlyRate.toFixed(2)}/hr</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded-full ${
                          user.isActive
                            ? "bg-green-50 text-success"
                            : "bg-red-50 text-error"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3 text-sm">
                      {user.id !== session?.user?.id && (
                        <div className="flex space-x-2">
                          <Button
                            variant={user.isActive ? "danger" : "primary"}
                            onClick={() => toggleUserActive(user.id, user.isActive)}
                            className="text-xs px-2 py-1"
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          {user.role !== "ADMIN" && (
                            <Button
                              variant="danger"
                              onClick={() => deleteUser(user.id, user.name)}
                              className="text-xs px-2 py-1"
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
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
