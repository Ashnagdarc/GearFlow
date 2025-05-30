import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, FileText, FileSpreadsheet } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { WeeklyUsageReport, GearUsage, generateUsageReportForRange } from "@/services/report";
import { generatePdfReport, generateCsvReport } from "@/services/reportExport";

// Helper to format numbers with commas
const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

interface WeeklyReportProps {
  dateRange: DateRange | undefined;
}

export function WeeklyActivityReport({ dateRange }: WeeklyReportProps) {
  const [report, setReport] = useState<WeeklyUsageReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to generate the report based on date range
  const generateReport = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      setError('Please select a date range');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const generatedReport = await generateUsageReportForRange(
        dateRange.from,
        dateRange.to
      );
      setReport(generatedReport);
    } catch (err) {
      console.error('Error generating report:', err);
      setError('Failed to generate report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to download the report as CSV
  const downloadAsCsv = () => {
    if (!report) return;
    generateCsvReport(report);
  };

  // Function to download the report as PDF
  const downloadAsPdf = () => {
    if (!report) return;
    const title = `Gear Activity Report: ${report.startDate} to ${report.endDate}`;
    generatePdfReport(report, title);
  };

  // Function to calculate total activity count
  const calculateTotalActivity = (gear: GearUsage): number => {
    return gear.requestCount + gear.checkoutCount + gear.checkinCount + gear.bookingCount + gear.damageCount;
  };

  // Calculate activity totals if report exists
  const totals = report?.gearUsage.reduce(
    (acc, gear) => {
      return {
        requests: acc.requests + gear.requestCount,
        checkouts: acc.checkouts + gear.checkoutCount,
        checkins: acc.checkins + gear.checkinCount,
        bookings: acc.bookings + gear.bookingCount,
        damages: acc.damages + gear.damageCount
      };
    },
    { requests: 0, checkouts: 0, checkins: 0, bookings: 0, damages: 0 }
  );

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Weekly Activity Report</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={generateReport}
              disabled={isLoading || !dateRange?.from || !dateRange?.to}
              size="sm"
              variant="outline"
              className="h-9"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                    <path d="M3.5 2C3.22386 2 3 2.22386 3 2.5V12.5C3 12.7761 3.22386 13 3.5 13H11.5C11.7761 13 12 12.7761 12 12.5V6H8.5C8.22386 6 8 5.77614 8 5.5V2H3.5ZM9 2.70711L11.2929 5H9V2.70711ZM2 2.5C2 1.67157 2.67157 1 3.5 1H8.5C8.63261 1 8.75979 1.05268 8.85355 1.14645L12.8536 5.14645C12.9473 5.24021 13 5.36739 13 5.5V12.5C13 13.3284 12.3284 14 11.5 14H3.5C2.67157 14 2 13.3284 2 12.5V2.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                  </svg>
                  Generate Report
                </>
              )}
            </Button>
            {report && (
              <div className="flex gap-2">
                <Button onClick={downloadAsCsv} size="sm" variant="outline" className="h-9">
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-green-500" />
                  CSV
                </Button>
                <Button onClick={downloadAsPdf} size="sm" variant="outline" className="h-9">
                  <FileText className="mr-2 h-4 w-4 text-blue-500" />
                  PDF
                </Button>
              </div>
            )}
          </div>
        </div>
        <CardDescription>
          Comprehensive summary of gear activities for the selected period
          {report && ` (${report.startDate} to ${report.endDate})`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-destructive/10 p-4 rounded-lg mb-4 text-destructive border border-destructive/20">
            <p className="font-medium">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Generating report...</span>
          </div>
        ) : report ? (
          <div className="space-y-6">
            {report.gearUsage.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                    <p className="text-xs text-primary uppercase font-semibold">Total Requests</p>
                    <p className="text-2xl font-bold">{formatNumber(totals?.requests || 0)}</p>
                  </div>
                  <div className="bg-green-500/10 dark:bg-green-900/20 p-4 rounded-lg border border-green-500/20">
                    <p className="text-xs text-green-500 dark:text-green-400 uppercase font-semibold">Total Check-outs</p>
                    <p className="text-2xl font-bold">{formatNumber(totals?.checkouts || 0)}</p>
                  </div>
                  <div className="bg-purple-500/10 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-500/20">
                    <p className="text-xs text-purple-500 dark:text-purple-400 uppercase font-semibold">Total Check-ins</p>
                    <p className="text-2xl font-bold">{formatNumber(totals?.checkins || 0)}</p>
                  </div>
                  <div className="bg-yellow-500/10 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-500/20">
                    <p className="text-xs text-yellow-500 dark:text-yellow-400 uppercase font-semibold">Total Bookings</p>
                    <p className="text-2xl font-bold">{formatNumber(totals?.bookings || 0)}</p>
                  </div>
                  <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                    <p className="text-xs text-destructive uppercase font-semibold">Damage Reports</p>
                    <p className="text-2xl font-bold">{formatNumber(totals?.damages || 0)}</p>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[300px]">Gear Name</TableHead>
                        <TableHead className="text-center">Requests</TableHead>
                        <TableHead className="text-center">Check-Outs</TableHead>
                        <TableHead className="text-center">Check-Ins</TableHead>
                        <TableHead className="text-center">Bookings</TableHead>
                        <TableHead className="text-center">Damages</TableHead>
                        <TableHead className="text-center">Total Activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.gearUsage.map((gear, index) => (
                        <TableRow key={gear.id || index} className={index % 2 === 0 ? "bg-card" : "bg-muted/10 hover:bg-muted/20"}>
                          <TableCell className="font-medium">{gear.gearName}</TableCell>
                          <TableCell className="text-center">{gear.requestCount}</TableCell>
                          <TableCell className="text-center">{gear.checkoutCount}</TableCell>
                          <TableCell className="text-center">{gear.checkinCount}</TableCell>
                          <TableCell className="text-center">{gear.bookingCount}</TableCell>
                          <TableCell className="text-center">
                            {gear.damageCount > 0 ? (
                              <Badge variant="destructive" className="font-bold">
                                {gear.damageCount}
                              </Badge>
                            ) : (
                              gear.damageCount
                            )}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {calculateTotalActivity(gear)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-muted/10 rounded-lg border">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                <p className="mt-2 text-muted-foreground">No activity data found for the selected period.</p>
                <p className="text-sm text-muted-foreground/70">Try selecting a different date range.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/10 rounded-lg border">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
            <p className="mt-2 text-muted-foreground">Select a date range and click "Generate Report" to create a new activity report.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
