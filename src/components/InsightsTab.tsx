import { useState, useEffect } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, getEntries } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCategoryColor, getTrackerIcon } from "@/lib/categoryHelpers";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";
import { generateRandomEntriesForLastNDays, clearAllEntries } from "@/lib/demoData";
import { Sparkles, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { localizeTrackerTitle, localizeTrackerAdvice } from "@/lib/trackerLocalize";

export const InsightsTab = () => {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [trackersData, entriesData] = await Promise.all([
      getTrackers(),
      getEntries(),
    ]);
    setTrackers(trackersData);
    setEntries(entriesData);
    setLoading(false);
  };

  const getTrackerStats = (tracker: Tracker) => {
    const today = new Date();
    const periodStart = new Date(today);
    periodStart.setDate(today.getDate() - tracker.periodDays);

    const relevantEntries = entries.filter((e) => {
      if (e.trackerId !== tracker.id) return false;
      const entryDate = new Date(e.date);
      return entryDate >= periodStart && entryDate <= today;
    });

    const answerDays = relevantEntries.length;
    const problemDays = relevantEntries.filter((e) => {
      return tracker.problemWhen === "yes" ? e.value : !e.value;
    }).length;

    const ratio = tracker.periodDays > 0 ? problemDays / tracker.periodDays : 0;

    let status: "ok" | "watch" | "warning" = "ok";
    if (problemDays >= tracker.threshold) {
      status = "warning";
    } else if (problemDays >= tracker.threshold * 0.5) {
      status = "watch";
    }

    return { answerDays, problemDays, ratio, status };
  };

  const handleGenerateDemoData = async () => {
    if (trackers.length === 0) {
      toast({
        title: "No trackers found",
        description: "Please add some trackers first before generating demo data.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      await generateRandomEntriesForLastNDays(60);
      await loadData();
      toast({
        title: "Demo data generated!",
        description: "Created 60 days of random entries for all trackers.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate demo data",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleClearAllEntries = async () => {
    if (!confirm("Are you sure you want to delete all entries? This cannot be undone.")) {
      return;
    }

    setGenerating(true);
    try {
      await clearAllEntries();
      await loadData();
      toast({
        title: "All entries cleared",
        description: "All tracker entries have been deleted.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear entries",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (trackers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <p className="text-xl font-semibold mb-2">Welcome to MeMap</p>
        <p className="text-sm text-muted-foreground max-w-md">
          Start by adding a few trackers you're curious about — mood, relationships, work, health or just for fun.
        </p>
      </div>
    );
  }

  const radarData = trackers.map((tracker) => {
    const stats = getTrackerStats(tracker);
    const percentage = Math.round(stats.ratio * 100);
    return {
      category: tracker.category,
      value: percentage,
      fullMark: 100,
    };
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Test Tools */}
      {trackers.length > 0 && (
        <Card className="border-dashed animate-fade-in">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Test Tools (for development)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateDemoData}
              disabled={generating}
              className="flex-1 min-w-[180px]"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {generating ? "Generating..." : "Generate demo data (60 days)"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAllEntries}
              disabled={generating}
              className="flex-1 min-w-[140px]"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear all entries
            </Button>
          </CardContent>
        </Card>
      )}

      {radarData.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-lg">Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis 
                  dataKey="category" 
                  tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                />
                <Radar
                  name="Problem %"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
            <p className="text-xs text-center text-muted-foreground mt-2">
              % of problem days by category
            </p>
          </CardContent>
        </Card>
      )}

      {trackers.map((tracker) => {
        const stats = getTrackerStats(tracker);
        const percentage = Math.round(stats.ratio * 100);
        const categoryColor = getCategoryColor(tracker.category);
        const Icon = getTrackerIcon(tracker.title, tracker.category);

        return (
          <Card 
            key={tracker.id}
            className="animate-fade-in border-l-4 transition-all hover:shadow-md"
            style={{ borderLeftColor: `hsl(var(--${categoryColor}))` }}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    data-tracker-icon
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `hsl(var(--${categoryColor}) / 0.22)` }}
                  >
                    <Icon className="h-5 w-5 text-foreground" strokeWidth={1.75} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{localizeTrackerTitle(tracker.title)}</CardTitle>
                    <p className="text-xs font-medium mt-1" style={{ color: `hsl(var(--${categoryColor}))` }}>
                      {tracker.category}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={stats.status === "warning" ? "destructive" : "secondary"}
                  className={`
                    ${stats.status === "watch" ? "bg-warning text-warning-foreground" : ""}
                    ${stats.status === "ok" ? "bg-success text-success-foreground" : ""}
                    text-xs font-medium
                  `}
                >
                  {stats.status === "warning" && "🔴 Warning"}
                  {stats.status === "watch" && "🟡 Watch"}
                  {stats.status === "ok" && "🟢 OK"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                In the last <span className="font-semibold">{tracker.periodDays} days</span>:{" "}
                <span 
                  className="font-bold text-base"
                  style={{ color: stats.status === "warning" ? "hsl(var(--destructive))" : `hsl(var(--${categoryColor}))` }}
                >
                  {stats.problemDays} problem days
                </span>
              </p>

              <div className="space-y-2">
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: stats.status === "warning" 
                        ? "hsl(var(--destructive))" 
                        : stats.status === "watch"
                        ? "hsl(var(--warning))"
                        : "hsl(var(--success))"
                    }}
                  />
                </div>
                <p className="text-xs text-right text-muted-foreground">{percentage}%</p>
              </div>

              {stats.status === "warning" && (
                <div 
                  className="p-3 rounded-2xl border-l-4"
                  style={{ 
                    backgroundColor: "hsl(var(--destructive) / 0.1)",
                    borderLeftColor: "hsl(var(--destructive))"
                  }}
                >
                  <p className="text-sm font-medium text-destructive">
                    {localizeTrackerAdvice(tracker.adviceAboveThreshold)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Disclaimer */}
      <div className="pt-6 mt-8">
        <p className="text-xs text-muted-foreground text-center px-4 leading-relaxed">
          MeMap is a self-awareness tool. It does not provide medical or mental health diagnosis. 
          If your statistics worry you, consider reaching out to a qualified professional.
        </p>
      </div>
    </div>
  );
};
