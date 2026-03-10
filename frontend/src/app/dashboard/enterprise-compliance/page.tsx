"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShieldCheck,
  ChevronLeft,
  Loader2,
  FileText,
  Globe,
  ScrollText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  Settings2,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const FRAMEWORKS = ["SOC2", "GDPR", "HIPAA", "ISO27001", "PCI_DSS"] as const;

export default function EnterpriseCompliancePage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const orgId = user?.organizationId ?? "";
  const [activeTab, setActiveTab] = useState("dashboard");
  const [auditPage, setAuditPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState("");

  // Dashboard
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["compliance-dashboard", orgId],
    queryFn: () => api.compliance.getDashboard(orgId),
    enabled: !!orgId,
  });

  // Settings
  const { data: settings } = useQuery({
    queryKey: ["compliance-settings", orgId],
    queryFn: () => api.compliance.getSettings(orgId),
    enabled: !!orgId,
  });

  // Reports
  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ["compliance-reports", orgId],
    queryFn: () => api.compliance.getReports(orgId),
    enabled: !!orgId,
  });

  // Audit logs
  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ["compliance-audit-logs", orgId, auditPage, auditSearch],
    queryFn: () =>
      api.compliance.getAuditLogs(orgId, {
        page: auditPage,
        limit: 20,
        search: auditSearch || undefined,
      }),
    enabled: !!orgId,
  });

  // Data residency
  const { data: residency } = useQuery({
    queryKey: ["compliance-residency", orgId],
    queryFn: () => api.compliance.getDataResidency(orgId),
    enabled: !!orgId,
  });

  // Regions
  const { data: regions } = useQuery({
    queryKey: ["compliance-regions"],
    queryFn: () => api.compliance.getRegions(),
  });

  // Generate report
  const generateReportMut = useMutation({
    mutationFn: (framework: string) =>
      api.compliance.generateReport(orgId, framework),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-reports"] });
      queryClient.invalidateQueries({ queryKey: ["compliance-dashboard"] });
      toast.success("Compliance report generated");
    },
    onError: () => toast.error("Failed to generate report"),
  });

  // Generate all reports
  const generateAllMut = useMutation({
    mutationFn: () => api.compliance.generateAllReports(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-reports"] });
      queryClient.invalidateQueries({ queryKey: ["compliance-dashboard"] });
      toast.success("All compliance reports generated");
    },
    onError: () => toast.error("Failed to generate reports"),
  });

  // Export audit logs
  const exportAuditMut = useMutation({
    mutationFn: (format: "csv" | "json") =>
      api.compliance.exportAuditLogs(orgId, format),
    onSuccess: () => toast.success("Audit logs exported"),
    onError: () => toast.error("Export failed"),
  });

  // Export audit package
  const exportPackageMut = useMutation({
    mutationFn: (framework: string) =>
      api.compliance.exportAuditPackage(orgId, framework),
    onSuccess: () => toast.success("Audit package exported"),
    onError: () => toast.error("Export failed"),
  });

  // Enforce policy
  const enforcePolicyMut = useMutation({
    mutationFn: (policy: string) =>
      api.compliance.enforcePolicy(orgId, policy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-settings"] });
      toast.success("Policy enforced");
    },
    onError: () => toast.error("Failed to enforce policy"),
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) {return "text-green-600";}
    if (score >= 70) {return "text-yellow-600";}
    return "text-red-600";
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  Enterprise Compliance
                </span>
              </div>
            </div>
            <Button
              onClick={() => generateAllMut.mutate()}
              disabled={generateAllMut.isPending}
            >
              {generateAllMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Run All Checks
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">
              <ShieldCheck className="h-4 w-4 mr-1" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="reports">
              <FileText className="h-4 w-4 mr-1" /> Reports
            </TabsTrigger>
            <TabsTrigger value="audit">
              <ScrollText className="h-4 w-4 mr-1" /> Audit Logs
            </TabsTrigger>
            <TabsTrigger value="residency">
              <Globe className="h-4 w-4 mr-1" /> Data Residency
            </TabsTrigger>
            <TabsTrigger value="policies">
              <Settings2 className="h-4 w-4 mr-1" /> Policies
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            {dashLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground">
                        Overall Score
                      </div>
                      <div
                        className={`text-3xl font-bold ${getScoreColor(
                          dashboard?.overallScore ?? 0
                        )}`}
                      >
                        {dashboard?.overallScore ?? 0}%
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground">
                        Frameworks Active
                      </div>
                      <div className="text-3xl font-bold">
                        {dashboard?.activeFrameworks ?? 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground">
                        Critical Alerts
                      </div>
                      <div className="text-3xl font-bold text-red-600">
                        {dashboard?.criticalAlerts ?? 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground">
                        Last Audit
                      </div>
                      <div className="text-lg font-semibold">
                        {dashboard?.lastAuditDate
                          ? new Date(
                              dashboard.lastAuditDate
                            ).toLocaleDateString()
                          : "Never"}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Framework scores */}
                <Card>
                  <CardHeader>
                    <CardTitle>Framework Compliance</CardTitle>
                    <CardDescription>
                      Compliance score by regulatory framework
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboard?.frameworks?.map(
                        (fw: {
                          name: string;
                          score: number;
                          status: string;
                          lastCheck?: string;
                        }) => (
                          <div
                            key={fw.name}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              {fw.status === "compliant" ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : fw.status === "partial" ? (
                                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                              <div>
                                <div className="font-medium">{fw.name}</div>
                                {fw.lastCheck && (
                                  <div className="text-xs text-muted-foreground">
                                    Last checked:{" "}
                                    {new Date(
                                      fw.lastCheck
                                    ).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div
                                className={`text-xl font-bold ${getScoreColor(
                                  fw.score
                                )}`}
                              >
                                {fw.score}%
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  generateReportMut.mutate(fw.name)
                                }
                                disabled={generateReportMut.isPending}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />{" "}
                                Refresh
                              </Button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Compliance Reports</CardTitle>
                  <CardDescription>
                    Generated compliance reports and audit packages
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {FRAMEWORKS.map((fw) => (
                    <Button
                      key={fw}
                      size="sm"
                      variant="outline"
                      onClick={() => generateReportMut.mutate(fw)}
                      disabled={generateReportMut.isPending}
                    >
                      {fw}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !reports?.length ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No reports generated yet.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Framework</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Generated</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map(
                        (r: {
                          id: string;
                          framework: string;
                          score: number;
                          status: string;
                          createdAt: string;
                        }) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">
                              {r.framework}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`font-bold ${getScoreColor(
                                  r.score
                                )}`}
                              >
                                {r.score}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  r.status === "passed"
                                    ? "default"
                                    : "destructive"
                                }
                              >
                                {r.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(r.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  exportPackageMut.mutate(r.framework)
                                }
                              >
                                <Download className="h-3 w-3 mr-1" />{" "}
                                Export
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Audit Logs</CardTitle>
                  <CardDescription>
                    Complete activity audit trail
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportAuditMut.mutate("csv")}
                  >
                    <Download className="h-3 w-3 mr-1" /> CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportAuditMut.mutate("json")}
                  >
                    <Download className="h-3 w-3 mr-1" /> JSON
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Input
                    placeholder="Search audit logs..."
                    value={auditSearch}
                    onChange={(e) => {
                      setAuditSearch(e.target.value);
                      setAuditPage(1);
                    }}
                  />
                </div>
                {auditLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !auditLogs?.data?.length ? (
                  <div className="text-center py-8">
                    <ScrollText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No audit logs found
                    </p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Resource</TableHead>
                          <TableHead>IP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.data.map(
                          (log: {
                            id: string;
                            timestamp: string;
                            userName?: string;
                            action: string;
                            resourceType?: string;
                            ipAddress?: string;
                          }) => (
                            <TableRow key={log.id}>
                              <TableCell className="text-xs">
                                {new Date(log.timestamp).toLocaleString()}
                              </TableCell>
                              <TableCell>{log.userName ?? "System"}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {log.action}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {log.resourceType ?? "-"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {log.ipAddress ?? "-"}
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                    <div className="flex justify-between items-center mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={auditPage <= 1}
                        onClick={() => setAuditPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {auditPage}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAuditPage((p) => p + 1)}
                        disabled={
                          !auditLogs?.data || auditLogs.data.length < 20
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Residency Tab */}
          <TabsContent value="residency">
            <Card>
              <CardHeader>
                <CardTitle>Data Residency</CardTitle>
                <CardDescription>
                  Configure where your data is stored to meet regulatory
                  requirements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3">Current Policy</h3>
                    {residency ? (
                      <div className="p-4 border rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">
                            Primary Region: {residency.primaryRegion ?? "Not set"}
                          </span>
                        </div>
                        {residency.allowedRegions && (
                          <div className="flex gap-1 flex-wrap">
                            {residency.allowedRegions.map((r: string) => (
                              <Badge key={r} variant="secondary">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        No residency policy configured
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-3">Available Regions</h3>
                    <div className="space-y-2">
                      {regions?.map(
                        (r: {
                          id: string;
                          name: string;
                          location: string;
                        }) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <span className="font-medium">{r.name}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                {r.location}
                              </span>
                            </div>
                            <Globe className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Policies Tab */}
          <TabsContent value="policies">
            <Card>
              <CardHeader>
                <CardTitle>Security Policies</CardTitle>
                <CardDescription>
                  Enforce organizational security policies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      policy: "mfa",
                      label: "Multi-Factor Authentication",
                      desc: "Require MFA for all users",
                    },
                    {
                      policy: "password",
                      label: "Password Policy",
                      desc: "Enforce strong password requirements",
                    },
                    {
                      policy: "session",
                      label: "Session Policy",
                      desc: "Enforce session timeout and limits",
                    },
                  ].map((p) => (
                    <Card key={p.policy}>
                      <CardContent className="pt-6">
                        <h3 className="font-semibold">{p.label}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {p.desc}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge
                            variant={
                              settings?.policies?.[p.policy]
                                ? "default"
                                : "secondary"
                            }
                          >
                            {settings?.policies?.[p.policy]
                              ? "Enforced"
                              : "Not Enforced"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              enforcePolicyMut.mutate(p.policy)
                            }
                            disabled={enforcePolicyMut.isPending}
                          >
                            {enforcePolicyMut.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Enforce"
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* GDPR Section */}
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">
                    GDPR Data Subject Rights
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <h4 className="font-medium mb-2">Data Export</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Request a copy of all your personal data
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            api.compliance
                              .requestDataExport()
                              .then(() =>
                                toast.success("Data export requested")
                              )
                              .catch(() =>
                                toast.error("Failed to request export")
                              )
                          }
                        >
                          <Download className="h-3 w-3 mr-1" /> Request
                          Export
                        </Button>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <h4 className="font-medium mb-2">Data Deletion</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Request deletion of all your personal data
                        </p>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            api.compliance
                              .requestDataDeletion()
                              .then(() =>
                                toast.success("Deletion request submitted")
                              )
                              .catch(() =>
                                toast.error("Request failed")
                              )
                          }
                        >
                          Request Deletion
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
