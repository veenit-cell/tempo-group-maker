import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetDashboardStats, useGetExpiringSoon, useGetRecentActivity } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Activity, Clock, MessageSquare, Layers, Users } from "lucide-react";
import { DeadlineTimer } from "@/components/deadline-timer";
import { Skeleton } from "@/components/ui/skeleton";

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: expiringGroups, isLoading: expiringLoading } = useGetExpiringSoon();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();

  return (
    <Layout>
      <div className="space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your temporary groups.</p>
        </header>

        {statsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Active Groups</CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeGroups}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalMessages}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Closed Groups</CardTitle>
                <Archive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.closedGroups}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Archived</CardTitle>
                <Archive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.archivedGroups}</div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Expiring Soon
              </CardTitle>
              <CardDescription>Groups that need your attention</CardDescription>
            </CardHeader>
            <CardContent>
              {expiringLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : expiringGroups?.length ? (
                <div className="space-y-4">
                  {expiringGroups.map(group => (
                    <Link key={group.id} href={`/groups/${group.id}`}>
                      <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group">
                        <div>
                          <h4 className="font-semibold group-hover:text-primary transition-colors">{group.name}</h4>
                          <p className="text-sm text-muted-foreground capitalize">{group.purpose}</p>
                        </div>
                        <DeadlineTimer deadline={group.deadline} urgency={group.urgency} />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground border border-dashed border-border rounded-lg">
                  No groups expiring soon.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest messages across your groups</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : activity?.length ? (
                <div className="space-y-4">
                  {activity.map(item => (
                    <Link key={item.groupId} href={`/groups/${item.groupId}`}>
                      <div className="flex flex-col p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">{item.groupName}</h4>
                          <span className="text-xs text-muted-foreground">
                            {item.lastMessageAt ? formatDistanceToNow(new Date(item.lastMessageAt), { addSuffix: true }) : ''}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          <span className="font-medium text-foreground">{item.lastMessageUser}:</span> {item.lastMessage || 'Started the group'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground border border-dashed border-border rounded-lg">
                  No recent activity.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

function Archive(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>;
}
