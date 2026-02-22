'use client';

import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  TreePine, ArrowLeft, BarChart3, Award,
  Leaf, Factory, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useCarbonFootprint } from '@/hooks/use-new-features';
import Link from 'next/link';

interface FootprintData {
  totalCO2: number;
  offsetCO2: number;
  treesEquivalent: number;
  breakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface BadgeData {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  icon: string;
}

interface OffsetOption {
  id: string;
  name: string;
  description: string;
  pricePerTon: number;
  provider: string;
  verified: boolean;
}

export default function CarbonFootprintPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const { footprint, ecoReport, badges, offsetOptions, purchaseOffset } = useCarbonFootprint(projectId);

  // Normalize data to ensure we always have the right structure for mapping
  const footprintData = footprint.data && (footprint.data as unknown as ApiResponse<FootprintData>).success
    ? (footprint.data as unknown as ApiResponse<FootprintData>).data
    : footprint.data as FootprintData;

  const badgeList = Array.isArray(badges.data)
    ? badges.data as BadgeData[]
    : (badges.data as unknown as ApiResponse<BadgeData[]>)?.data || (badges.data as Record<string, unknown>)?.badges as BadgeData[] || [];

  const offsetList = Array.isArray(offsetOptions.data)
    ? offsetOptions.data as OffsetOption[]
    : (offsetOptions.data as unknown as ApiResponse<OffsetOption[]>)?.data || (offsetOptions.data as Record<string, unknown>)?.options as OffsetOption[] || [];

  const handleOffset = async (optionId: string) => {
    try {
      await purchaseOffset.mutateAsync({ optionId, amount: 1 });
      toast.success('Carbon offset purchased! Thank you.');
    } catch {
      toast.error('Failed to purchase offset');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TreePine className="w-8 h-8 text-green-600" />
              Carbon Footprint
            </h1>
            <p className="text-muted-foreground mt-1">
              Track and offset your presentation carbon footprint
            </p>
          </div>
        </div>

        {/* Carbon Overview */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-green-500/30">
            <CardContent className="p-4 text-center">
              <Factory className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-3xl font-bold">{footprintData?.totalCO2 || 0}g</p>
              <p className="text-xs text-muted-foreground">Total CO₂ Generated</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/30">
            <CardContent className="p-4 text-center">
              <Leaf className="w-6 h-6 mx-auto text-green-500 mb-2" />
              <p className="text-3xl font-bold">{footprintData?.offsetCO2 || 0}g</p>
              <p className="text-xs text-muted-foreground">CO₂ Offset</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/30">
            <CardContent className="p-4 text-center">
              <TreePine className="w-6 h-6 mx-auto text-green-600 mb-2" />
              <p className="text-3xl font-bold">{footprintData?.treesEquivalent || 0}</p>
              <p className="text-xs text-muted-foreground">Trees Equivalent</p>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown */}
        {footprintData?.breakdown && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5" /> Carbon Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {footprintData.breakdown.map((item: { category: string; amount: number; percentage: number }) => (
                <div key={item.category} className="flex items-center gap-4">
                  <span className="text-sm w-32 text-muted-foreground">{item.category}</span>
                  <div className="flex-1">
                    <Progress value={item.percentage} className="h-2" />
                  </div>
                  <span className="text-sm font-medium w-16 text-right">{item.amount}g</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Eco Badges */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="w-5 h-5" /> Eco Badges
            </CardTitle>
            <CardDescription>Achievements for sustainable presentation practices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {badgeList.map((badge: { id: string; name: string; description: string; earned: boolean; icon: string }, index: number) => (
                <div
                   
                  key={badge.id || index}
                  className={`p-4 rounded-lg border text-center ${badge.earned ? 'border-green-500/30 bg-green-500/5' : 'opacity-40'
                    }`}
                >
                  <div className="text-2xl mb-1">{badge.icon || '🌱'}</div>
                  <p className="text-xs font-medium">{badge.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
                  {badge.earned && <Badge className="mt-2 bg-green-500/10 text-green-600 text-xs">Earned</Badge>}
                </div>
              ))}
              {badgeList.length === 0 && (
                <p className="col-span-full text-center text-sm text-muted-foreground py-4">
                  Start using eco features to earn badges!
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Offset Options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TreePine className="w-5 h-5" /> Carbon Offset Programs
            </CardTitle>
            <CardDescription>Support verified carbon offset projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {offsetList.map((opt: { id: string; name: string; description: string; pricePerTon: number; provider: string; verified: boolean }, index: number) => (
                 
                <div key={opt.id || index} className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm">{opt.name}</p>
                    {opt.verified && <Badge className="bg-green-500/10 text-green-600 text-xs">Verified</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{opt.description}</p>
                  <p className="text-xs text-muted-foreground">Provider: {opt.provider}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-medium">${opt.pricePerTon}/ton</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOffset(opt.id)}
                      disabled={purchaseOffset.isPending}
                    >
                      <Leaf className="w-3 h-3 mr-1" /> Offset
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Eco Report */}
        {ecoReport.data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Eco Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/5 border border-green-500/10">
                <div>
                  <p className="font-medium">Monthly Sustainability Report</p>
                  <p className="text-sm text-muted-foreground">
                    Period: {ecoReport.data.period || 'This month'}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="w-3 h-3 mr-1" /> Download PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
