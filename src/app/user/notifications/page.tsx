"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BellRing, Trash2, CheckCheck, Megaphone, Info, Clock, CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from '@/lib/supabase/client';
import { Skeleton } from "@/components/ui/skeleton";

type Announcement = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  read?: boolean;
};

// Add types at the top of the file after the Announcement type
type ReadNotification = {
  notification_id: string;
};

type ReadAnnouncement = {
  announcement_id: string;
};

// Define a type for the tab values to be consistent throughout the component
type TabValue = 'all' | 'system' | 'announcements';

export default function UserNotificationsPage() {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readAnnouncements, setReadAnnouncements] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchNotificationsAndReadStatus = async () => {
      setIsLoading(true);
      try {
        // Get current user
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          console.error('No user found');
          return;
        }

        // Fetch read notifications
        const { data: readData, error: readError } = await supabase
          .from('read_notifications')
          .select('notification_id')
          .eq('user_id', userData.user.id);

        if (readError) {
          console.error('Error fetching read notifications:', readError);
        } else {
          const readIds = readData?.map((item: ReadNotification) => item.notification_id) || [];
          setReadNotificationIds(readIds);
        }

        // Fetch announcements
        const { data: announcementsData, error: announcementsError } = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false });

        if (announcementsError) {
          console.error("Error fetching announcements:", announcementsError);
        } else if (announcementsData) {
          setAnnouncements(announcementsData);
        }

        // Fetch read_announcements
        const { data: readAnnouncementsData, error: readAnnouncementsError } = await supabase
          .from('read_announcements')
          .select('announcement_id')
          .eq('user_id', userData.user.id);

        if (!readAnnouncementsError && readAnnouncementsData) {
          setReadAnnouncements(readAnnouncementsData.map((item: ReadAnnouncement) => item.announcement_id));
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotificationsAndReadStatus();

    // Set up refresh interval
    const refreshInterval = setInterval(() => {
      fetchNotificationsAndReadStatus();
    }, 30000); // Refresh every 30 seconds

    // Cleanup interval on unmount
    return () => clearInterval(refreshInterval);
  }, [supabase]);

  const markAnnouncementAsRead = async (id: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase
        .from('read_announcements')
        .upsert([
          { user_id: userData.user.id, announcement_id: id }
        ]);

      if (error) {
        console.error("Error marking announcement as read:", error);
      } else {
        setReadAnnouncements(prev => [...prev, id]);
      }
    } catch (error) {
      console.error("Error marking announcement as read:", error);
    }
  };

  const markAsReadWithLogging = async (id: string) => {
    console.log('Mark Read button clicked for notification:', id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        console.error('No user found');
        return;
      }

      // Insert into read_notifications table
      const { error: readError } = await supabase
        .from('read_notifications')
        .insert([
          {
            user_id: userData.user.id,
            notification_id: id
          }
        ]);

      if (readError) {
        console.error('Error inserting into read_notifications:', readError);
        return;
      }

      // Update local state
      setReadNotificationIds(prev => [...prev, id]);

      // Call the markAsRead from the provider for UI update
      await markAsRead(id);

      console.log('Successfully marked notification as read:', id);
    } catch (error) {
      console.error('Error in markAsReadWithLogging:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        console.error('No user found');
        return;
      }

      // Get all unread notifications
      const unreadNotifications = notifications.filter(n => !readNotificationIds.includes(n.id));

      if (unreadNotifications.length === 0) return;

      // Create entries for read_notifications table
      const entries = unreadNotifications.map(n => ({
        user_id: userData.user.id,
        notification_id: n.id
      }));

      // Insert all entries into read_notifications table
      const { error } = await supabase
        .from('read_notifications')
        .insert(entries);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return;
      }

      // Update local state
      const newReadIds = unreadNotifications.map(n => n.id);
      setReadNotificationIds(prev => [...prev, ...newReadIds]);

      // Update UI through provider
      await markAllAsRead();

      console.log('Successfully marked all notifications as read');
    } catch (error) {
      console.error('Error in markAllNotificationsAsRead:', error);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    const isRead = readNotificationIds.includes(n.id);
    const readMatches = filter === 'all' || (filter === 'unread' && !isRead);
    let typeMatches = true;

    if (typeFilter !== 'all') {
      if (typeFilter === 'system') typeMatches = n.type === 'system';
      else if (typeFilter === 'request') typeMatches = n.message.toLowerCase().includes('request');
      else if (typeFilter === 'gear') typeMatches = n.message.toLowerCase().includes('gear');
    }

    if (activeTab === 'system') return n.type === 'system' && readMatches && typeMatches;
    else if (activeTab === 'announcements') return false;
    else return readMatches && typeMatches;
  });

  const filteredAnnouncements = announcements.filter(a => {
    const isRead = readAnnouncements.includes(a.id);
    return filter === 'all' || (filter === 'unread' && !isRead);
  });

  const deleteNotification = (id: string) => {
    // TODO: Call API to delete notification
  };

  const getIconForType = (type: string) => {
    // Customize icons based on notification type for better visual cues
    switch (type) {
      case 'request_approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'request_rejected': return <ShieldAlert className="h-4 w-4 text-red-500" />;
      case 'gear_due_soon': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'gear_overdue': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'new_announcement': return <Megaphone className="h-4 w-4 text-blue-500" />;
      case 'system': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <BellRing className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { y: 10, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  const unreadAnnouncementsCount = announcements.filter(a => !readAnnouncements.includes(a.id)).length;
  const unreadNotificationsCount = notifications.filter(n => !readNotificationIds.includes(n.id)).length;

  const markAllAnnouncementsAsRead = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const unreadAnnouncements = announcements
        .filter(a => !readAnnouncements.includes(a.id))
        .map(a => ({ user_id: userData.user!.id, announcement_id: a.id }));

      if (unreadAnnouncements.length === 0) return;

      const { error } = await supabase
        .from('read_announcements')
        .upsert(unreadAnnouncements);

      if (error) {
        console.error('Error marking all announcements as read:', error);
        return;
      }

      setReadAnnouncements(prev => [
        ...prev,
        ...announcements.filter(a => !readAnnouncements.includes(a.id)).map(a => a.id)
      ]);
    } catch (error) {
      console.error("Error marking all announcements as read:", error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-foreground">My Notifications</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant={filter === 'unread' ? 'secondary' : 'outline'} size="sm" onClick={() => setFilter('unread')}>
            Unread ({unreadNotificationsCount + unreadAnnouncementsCount})
          </Button>
          <Button variant={filter === 'all' ? 'secondary' : 'outline'} size="sm" onClick={() => setFilter('all')}>
            All
          </Button>
          {activeTab === 'all' || activeTab === 'system' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Mark all as read button clicked');
                markAllNotificationsAsRead();
              }}
              className="relative hover:bg-primary/10 focus:ring-2"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          ) : activeTab === 'announcements' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Mark all as read button clicked');
                markAllAnnouncementsAsRead();
              }}
              className="relative hover:bg-primary/10 focus:ring-2"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs
        defaultValue="all"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
        className="w-full"
      >
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="all" className="relative">
            All
            {(unreadNotificationsCount + unreadAnnouncementsCount) > 0 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {unreadNotificationsCount + unreadAnnouncementsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="system" className="relative">
            System Alerts
            {unreadNotificationsCount > 0 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {unreadNotificationsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="announcements" className="relative">
            Announcements
            {unreadAnnouncementsCount > 0 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {unreadAnnouncementsCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Updates & Alerts</CardTitle>
              <CardDescription>Stay informed about your requests and important updates.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-3 border rounded-md">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Announcements Section */}
                    {filteredAnnouncements.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Megaphone className="h-4 w-4 text-primary" />
                          Announcements
                        </h3>
                        <motion.ul
                          variants={containerVariants}
                          initial="hidden"
                          animate="visible"
                          className="space-y-3"
                        >
                          {filteredAnnouncements.map((announcement) => (
                            <motion.li
                              key={announcement.id}
                              variants={itemVariants}
                              className={`flex items-start justify-between p-3 rounded-md border ${readAnnouncements.includes(announcement.id)
                                ? 'bg-background'
                                : 'bg-primary/5 font-medium border-primary/20'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <Megaphone className="h-4 w-4 text-primary mt-1" />
                                <div>
                                  <p className="text-sm font-semibold">{announcement.title}</p>
                                  <p className="text-xs text-muted-foreground mb-1">
                                    {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                                  </p>
                                  <p className="text-xs">{announcement.content}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {!readAnnouncements.includes(announcement.id) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAnnouncementAsRead(announcement.id);
                                    }}
                                    className="whitespace-nowrap hover:bg-primary/20 focus:ring-2 focus:ring-primary/20"
                                  >
                                    Mark Read
                                  </Button>
                                )}
                              </div>
                            </motion.li>
                          ))}
                        </motion.ul>
                      </div>
                    )}

                    {/* System Notifications Section */}
                    {filteredNotifications.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <BellRing className="h-4 w-4 text-primary" />
                          System Notifications
                        </h3>
                        <motion.ul
                          variants={containerVariants}
                          initial="hidden"
                          animate="visible"
                          className="space-y-3"
                        >
                          {filteredNotifications.map((notification) => (
                            <motion.li
                              key={notification.id}
                              variants={itemVariants}
                              className={`flex items-center justify-between p-3 rounded-md border ${readNotificationIds.includes(notification.id)
                                ? 'bg-background'
                                : 'bg-primary/5 font-medium border-primary/20'
                                }`}
                            >
                              <div className="flex items-center gap-3">
                                {getIconForType(notification.type)}
                                <div>
                                  <p className="text-sm">{notification.message}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {!readNotificationIds.includes(notification.id) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsReadWithLogging(notification.id);
                                    }}
                                    className="hover:bg-primary/20 focus:ring-2 focus:ring-primary/20"
                                  >
                                    Mark Read
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteNotification(notification.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </div>
                            </motion.li>
                          ))}
                        </motion.ul>
                      </div>
                    )}

                    {filteredAnnouncements.length === 0 && filteredNotifications.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-center py-10 text-muted-foreground"
                      >
                        <BellRing className="h-10 w-10 mx-auto mb-4 opacity-20" />
                        <p>No {filter === 'unread' ? 'unread ' : ''}notifications or announcements.</p>
                      </motion.div>
                    )}
                  </>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Notifications</CardTitle>
              <CardDescription>Updates about your gear requests and system alerts.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-3 border rounded-md">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredNotifications.length > 0 ? (
                  <motion.ul
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-3"
                  >
                    {filteredNotifications.map((notification) => (
                      <motion.li
                        key={notification.id}
                        variants={itemVariants}
                        className={`flex items-center justify-between p-3 rounded-md border ${readNotificationIds.includes(notification.id)
                          ? 'bg-background'
                          : 'bg-primary/5 font-medium border-primary/20'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          {getIconForType(notification.type)}
                          <div>
                            <p className="text-sm">{notification.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!readNotificationIds.includes(notification.id) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsReadWithLogging(notification.id);
                              }}
                              className="hover:bg-primary/20 focus:ring-2 focus:ring-primary/20"
                            >
                              Mark Read
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </motion.li>
                    ))}
                  </motion.ul>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-center py-10 text-muted-foreground"
                  >
                    <BellRing className="h-10 w-10 mx-auto mb-4 opacity-20" />
                    <p>No {filter === 'unread' ? 'unread ' : ''}system notifications.</p>
                  </motion.div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="announcements">
          <Card>
            <CardHeader>
              <CardTitle>Announcements</CardTitle>
              <CardDescription>Important updates and announcements from administration.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-3 border rounded-md">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredAnnouncements.length > 0 ? (
                  <motion.ul
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-3"
                  >
                    {filteredAnnouncements.map((announcement) => (
                      <motion.li
                        key={announcement.id}
                        variants={itemVariants}
                        className={`flex items-start justify-between p-3 rounded-md border ${readAnnouncements.includes(announcement.id)
                          ? 'bg-background'
                          : 'bg-primary/5 font-medium border-primary/20'
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <Megaphone className="h-4 w-4 text-primary mt-1" />
                          <div>
                            <p className="text-sm font-semibold">{announcement.title}</p>
                            <p className="text-xs text-muted-foreground mb-1">
                              {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                            </p>
                            <p className="text-sm">{announcement.content}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {!readAnnouncements.includes(announcement.id) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAnnouncementAsRead(announcement.id);
                              }}
                              className="whitespace-nowrap hover:bg-primary/20 focus:ring-2 focus:ring-primary/20"
                            >
                              Mark Read
                            </Button>
                          )}
                        </div>
                      </motion.li>
                    ))}
                  </motion.ul>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-center py-10 text-muted-foreground"
                  >
                    <Megaphone className="h-10 w-10 mx-auto mb-4 opacity-20" />
                    <p>No {filter === 'unread' ? 'unread ' : ''}announcements.</p>
                  </motion.div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
