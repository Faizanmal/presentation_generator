"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    BarChart3,
    LineChart,
    PieChart,
    AreaChart,
    Activity,
    Plus,
    Upload,
    Database,
    Settings,
    Loader2,
    RefreshCw,
    Sparkles,
    Eye,
    Table,
    Code,
    FileJson,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Card,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";

interface DataSource {
    id: string;
    type: "csv" | "google_sheets" | "api" | "manual";
    name: string;
    config: Record<string, unknown>;
}

interface ChartConfig {
    id: string;
    type: 'bar' | 'line' | 'pie' | 'area' | 'doughnut' | 'radar' | 'polarArea' | 'scatter' | 'donut';
    title: string;
    dataSourceId: string;
}

interface DataChartsPanelProps {
    projectId: string;
    slideId: string;
    onChartCreated?: (chart: ChartConfig) => void;
}

export function DataChartsPanel({
    projectId,
    slideId,
    onChartCreated,
}: DataChartsPanelProps) {
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"sources" | "charts">("charts");

    // Data source state
    const [sourceType, setSourceType] = useState<DataSource["type"] | "json">("csv");
    const [sourceName, setSourceName] = useState("");
    const [csvContent, setCsvContent] = useState("");
    const [jsonContent, setJsonContent] = useState("");
    const [sheetsUrl, setSheetsUrl] = useState("");
    const [apiUrl, setApiUrl] = useState("");
    const [apiHeaders, setApiHeaders] = useState<Record<string, string>>({});

    // Chart state
    const [chartType, setChartType] = useState<ChartConfig["type"]>("bar");
    const [chartTitle, setChartTitle] = useState("");
    const [selectedDataSource, setSelectedDataSource] = useState("");
    const [xAxis, setXAxis] = useState("");
    const [yAxis, setYAxis] = useState("");
    const [colorScheme, setColorScheme] = useState("default");

    // Fetch data sources
    const { data: dataSources = [] } = useQuery<DataSource[]>({
        queryKey: ["data-sources", projectId],
        queryFn: () => api.getDataSources(projectId) as Promise<DataSource[]>,
    });

    // Fetch charts
    const { data: charts = [], isLoading: chartsLoading } = useQuery<ChartConfig[]>({
        queryKey: ["charts", slideId],
        queryFn: () => api.getSlideCharts(slideId) as Promise<ChartConfig[]>,
    });

    // Create data source mutations
    const createCSVSourceMutation = useMutation({
        mutationFn: () => api.uploadCSVData(projectId, {
            name: sourceName,
            content: csvContent,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["data-sources", projectId] });
            toast.success("CSV data uploaded!");
            resetSourceForm();
        },
        onError: () => toast.error("Failed to upload CSV"),
    });

    const connectGoogleSheetsMutation = useMutation({
        mutationFn: () => api.connectGoogleSheets(projectId, {
            url: sheetsUrl,
            sheetName: sourceName,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["data-sources", projectId] });
            toast.success("Google Sheet connected!");
            resetSourceForm();
        },
        onError: () => toast.error("Failed to connect Google Sheet"),
    });

    const connectAPIMutation = useMutation({
        mutationFn: () => api.connectAPIData(projectId, {
            url: apiUrl,
            method: "GET",
            headers: apiHeaders,
            refreshInterval: 300,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["data-sources", projectId] });
            toast.success("API data source connected!");
            resetSourceForm();
        },
        onError: () => toast.error("Failed to connect API"),
    });

    const createJSONSourceMutation = useMutation({
        mutationFn: () => api.createJSONDataSource(projectId, {
            name: sourceName,
            content: jsonContent,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["data-sources", projectId] });
            toast.success("JSON data added!");
            resetSourceForm();
        },
        onError: () => toast.error("Failed to add JSON data"),
    });

    // Create chart mutation
    const createChartMutation = useMutation<ChartConfig, Error>({
        mutationFn: () => api.createChart(projectId, slideId, {
            type: chartType,
            title: chartTitle,
            dataSourceId: selectedDataSource,
            config: {
                xAxis,
                yAxis,
                colorScheme,
            },
        }) as unknown as Promise<ChartConfig>,
        onSuccess: (chart) => {
            queryClient.invalidateQueries({ queryKey: ["charts", slideId] });
            setIsCreateOpen(false);
            resetChartForm();
            toast.success("Chart created!");
            onChartCreated?.(chart);
        },
        onError: () => toast.error("Failed to create chart"),
    });

    // Suggest chart type mutation
    const suggestChartMutation = useMutation({
        mutationFn: (dataSourceId: string) => api.suggestChartType(projectId, dataSourceId),
        onSuccess: (result) => {
            setChartType(result.suggestedType as ChartConfig["type"]);
            toast.success(`AI suggests: ${result.suggestedType} chart`);
        },
        onError: () => toast.error("Failed to get chart suggestion"),
    });

    const resetSourceForm = () => {
        setSourceName("");
        setCsvContent("");
        setJsonContent("");
        setSheetsUrl("");
        setApiUrl("");
        setApiHeaders({});
    };

    const resetChartForm = () => {
        setChartTitle("");
        setSelectedDataSource("");
        setXAxis("");
        setYAxis("");
        setColorScheme("default");
    };

    const handleCreateSource = () => {
        switch (sourceType) {
            case "csv":
                createCSVSourceMutation.mutate();
                break;
            case "google_sheets":
                connectGoogleSheetsMutation.mutate();
                break;
            case "api":
                connectAPIMutation.mutate();
                break;
            case "json":
                createJSONSourceMutation.mutate();
                break;
        }
    };

    const isCreatingSource = createCSVSourceMutation.isPending ||
        connectGoogleSheetsMutation.isPending || connectAPIMutation.isPending || createJSONSourceMutation.isPending;

    const chartTypeInfo = {
        bar: { title: "Bar Chart", icon: BarChart3, color: "text-blue-500" },
        line: { title: "Line Chart", icon: LineChart, color: "text-green-500" },
        pie: { title: "Pie Chart", icon: PieChart, color: "text-orange-500" },
        area: { title: "Area Chart", icon: AreaChart, color: "text-purple-500" },
        scatter: { title: "Scatter Plot", icon: Activity, color: "text-pink-500" },
        donut: { title: "Donut Chart", icon: PieChart, color: "text-cyan-500" },
    };

    const sourceTypeInfo = {
        csv: { title: "CSV Upload", icon: Upload, description: "Upload a CSV file" },
        google_sheets: { title: "Google Sheets", icon: Table, description: "Connect a Google Sheet" },
        api: { title: "API Endpoint", icon: Database, description: "Connect to an API" },
        json: { title: "Raw JSON", icon: FileJson, description: "Paste raw JSON data" },
        manual: { title: "Manual Input", icon: Code, description: "Manually entered data" },
    };

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">Data Charts</h3>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Add
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Add Data Visualization</DialogTitle>
                            <DialogDescription>
                                Create charts from your data sources
                            </DialogDescription>
                        </DialogHeader>

                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                            <TabsList className="grid grid-cols-2 w-full">
                                <TabsTrigger value="charts">
                                    <BarChart3 className="h-4 w-4 mr-2" />
                                    Create Chart
                                </TabsTrigger>
                                <TabsTrigger value="sources">
                                    <Database className="h-4 w-4 mr-2" />
                                    Data Sources
                                </TabsTrigger>
                            </TabsList>

                            {/* Charts Tab */}
                            <TabsContent value="charts" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Chart Title</Label>
                                    <Input
                                        placeholder="Sales Overview"
                                        value={chartTitle}
                                        onChange={(e) => setChartTitle(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Data Source</Label>
                                    <div className="flex gap-2">
                                        <Select value={selectedDataSource} onValueChange={setSelectedDataSource}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a data source" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {dataSources?.map((source) => (
                                                    <SelectItem key={source.id} value={source.id}>
                                                        {source.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {selectedDataSource && (
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => suggestChartMutation.mutate(selectedDataSource)}
                                                disabled={suggestChartMutation.isPending}
                                            >
                                                {suggestChartMutation.isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Sparkles className="h-4 w-4" />
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Chart Type</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {Object.entries(chartTypeInfo).map(([key, info]) => {
                                            const Icon = info.icon;
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => setChartType(key as ChartConfig["type"])}
                                                    className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center gap-2 ${chartType === key
                                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                                                        }`}
                                                >
                                                    <Icon className={`h-6 w-6 ${info.color}`} />
                                                    <span className="text-xs font-medium">{info.title}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>X-Axis Field</Label>
                                        <Input
                                            placeholder="date"
                                            value={xAxis}
                                            onChange={(e) => setXAxis(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Y-Axis Field</Label>
                                        <Input
                                            placeholder="value"
                                            value={yAxis}
                                            onChange={(e) => setYAxis(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Color Scheme</Label>
                                    <Select value={colorScheme} onValueChange={setColorScheme}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="default">Default</SelectItem>
                                            <SelectItem value="brand">Brand Colors</SelectItem>
                                            <SelectItem value="pastel">Pastel</SelectItem>
                                            <SelectItem value="vibrant">Vibrant</SelectItem>
                                            <SelectItem value="monochrome">Monochrome</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    className="w-full"
                                    onClick={() => createChartMutation.mutate()}
                                    disabled={!chartTitle || !selectedDataSource || createChartMutation.isPending}
                                >
                                    {createChartMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4 mr-2" />
                                    )}
                                    Create Chart
                                </Button>
                            </TabsContent>

                            {/* Data Sources Tab */}
                            <TabsContent value="sources" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Source Type</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {Object.entries(sourceTypeInfo).map(([key, info]) => {
                                            const Icon = info.icon;
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => setSourceType(key as DataSource["type"])}
                                                    className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center gap-2 ${sourceType === key
                                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                                                        }`}
                                                >
                                                    <Icon className="h-6 w-6" />
                                                    <span className="text-xs font-medium">{info.title}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Source Name</Label>
                                    <Input
                                        placeholder="My Data Source"
                                        value={sourceName}
                                        onChange={(e) => setSourceName(e.target.value)}
                                    />
                                </div>

                                {sourceType === "csv" && (
                                    <div className="space-y-2">
                                        <Label>CSV Content</Label>
                                        <Textarea
                                            placeholder="date,value&#10;2024-01,100&#10;2024-02,150&#10;..."
                                            value={csvContent}
                                            onChange={(e) => setCsvContent(e.target.value)}
                                            rows={6}
                                            className="font-mono text-sm"
                                        />
                                        <p className="text-xs text-slate-500">
                                            Paste your CSV data or drag and drop a file
                                        </p>
                                    </div>
                                )}

                                {sourceType === "google_sheets" && (
                                    <div className="space-y-2">
                                        <Label>Google Sheets URL</Label>
                                        <Input
                                            placeholder="https://docs.google.com/spreadsheets/d/..."
                                            value={sheetsUrl}
                                            onChange={(e) => setSheetsUrl(e.target.value)}
                                        />
                                        <p className="text-xs text-slate-500">
                                            Make sure the sheet is publicly accessible or shared with the app
                                        </p>
                                    </div>
                                )}

                                {sourceType === "api" && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>API Endpoint URL</Label>
                                            <Input
                                                placeholder="https://api.example.com/data"
                                                value={apiUrl}
                                                onChange={(e) => setApiUrl(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Headers (optional)</Label>
                                            <Textarea
                                                placeholder='{"Authorization": "Bearer ..."}'
                                                value={JSON.stringify(apiHeaders, null, 2)}
                                                onChange={(e) => {
                                                    try {
                                                        setApiHeaders(JSON.parse(e.target.value));
                                                    } catch {
                                                        // Invalid JSON, ignore
                                                    }
                                                }}
                                                rows={3}
                                                className="font-mono text-sm"
                                            />
                                        </div>
                                    </div>
                                )}

                                {sourceType === "json" && (
                                    <div className="space-y-2">
                                        <Label>JSON Content</Label>
                                        <Textarea
                                            placeholder='[{"date": "2024-01", "value": 100}, ...]'
                                            value={jsonContent}
                                            onChange={(e) => setJsonContent(e.target.value)}
                                            rows={6}
                                            className="font-mono text-sm"
                                        />
                                        <p className="text-xs text-slate-500">
                                            Paste your JSON array of objects
                                        </p>
                                    </div>
                                )}

                                <Button
                                    className="w-full"
                                    onClick={handleCreateSource}
                                    disabled={!sourceName || isCreatingSource}
                                >
                                    {isCreatingSource ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4 mr-2" />
                                    )}
                                    Add Data Source
                                </Button>

                                {/* Existing Data Sources */}
                                {dataSources && dataSources.length > 0 && (
                                    <div className="pt-4 border-t">
                                        <Label className="mb-2 block">Existing Data Sources</Label>
                                        <div className="space-y-2">
                                            {dataSources.map((source) => (
                                                <div
                                                    key={source.id}
                                                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Database className="h-4 w-4 text-slate-500" />
                                                        <span className="text-sm font-medium">{source.name}</span>
                                                        <Badge variant="outline" className="text-xs">
                                                            {source.type === 'manual' ? 'JSON' :
                                                                source.type === 'google_sheets' ? 'Sheets' :
                                                                    source.type === 'api' ? 'API' :
                                                                        source.type === 'csv' ? 'CSV' : source.type}
                                                        </Badge>
                                                    </div>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7">
                                                        <RefreshCw className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Existing Charts */}
            {
                chartsLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                ) : charts && charts.length > 0 ? (
                    <div className="space-y-2">
                        {charts.map((chart) => {
                            const info = chartTypeInfo[chart.type as keyof typeof chartTypeInfo];
                            const Icon = info?.icon || BarChart3;

                            return (
                                <Card key={chart.id} className="p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                                            <Icon className={`h-4 w-4 ${info?.color || "text-slate-500"}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{chart.title}</p>
                                            <p className="text-xs text-slate-500">{info?.title || chart.type}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button size="icon" variant="ghost" className="h-8 w-8">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8">
                                                <Settings className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500">
                        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No charts yet</p>
                        <p className="text-xs">Create data visualizations for your slides</p>
                    </div>
                )
            }

            {/* Quick Add Chart Types */}
            <div className="grid grid-cols-3 gap-2">
                {Object.entries(chartTypeInfo).slice(0, 6).map(([key, info]) => {
                    const Icon = info.icon;
                    return (
                        <button
                            key={key}
                            onClick={() => {
                                setChartType(key as ChartConfig["type"]);
                                setActiveTab("charts");
                                setIsCreateOpen(true);
                            }}
                            className="p-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex flex-col items-center gap-1"
                        >
                            <Icon className={`h-4 w-4 ${info.color}`} />
                            <span className="text-[10px] text-slate-500">{info.title}</span>
                        </button>
                    );
                })}
            </div>
        </div >
    );
}
