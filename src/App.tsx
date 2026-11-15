import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, sendEmailVerification, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { FolderKanban, KeyRound, MailCheck, Plus, RefreshCw } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/firestoreErrors';
import {
  addComment,
  bulkDeleteTasks,
  bulkUpdateTasks,
  createProject,
  createProjectInvite,
  createTask,
  deleteComment,
  deleteCustomTemplate,
  deleteTask,
  deriveDisplayName,
  generateNextRecurringTask,
  joinProjectByInvite,
  moveTask,
  removeMember,
  revokeProjectInvite,
  saveCustomTemplate,
  syncUserProfile,
  updateComment,
  updateMemberRole,
  updateProjectDetails,
  updateTask,
  updateTaskDates,
} from './lib/firestoreService';
import {
  deleteNotification,
  loadNotificationPreferences,
  logProjectActivity,
  markAllNotificationsRead,
  markNotificationRead,
  sendNotification,
  shouldDeliverByPrefs,
  syncDeadlineReminders,
} from './lib/notificationService';
import { applyTaskFilters } from './lib/searchService';
import { buildTemplateFromProject } from './lib/templateService';
import {
  getIncompleteBlockers,
  isOverdueTask,
  localTodayIso,
} from './lib/validationService';
import {
  BOARD_COLUMNS,
  DEFAULT_FILTER_CRITERIA,
  DEFAULT_NOTIFICATION_PREFS,
  type AppNotification,
  type BoardActivityEvent,
  type FilterCriteria,
  type Milestone,
  type NotificationPreference,
  type NotificationType,
  type Project,
  type ProjectActivity,
  type ProjectMember,
  type ProjectMembership,
  type ProjectRole,
  type ProjectTemplate,
  type RecurrenceConfig,
  type SavedFilter,
  type Sprint,
  type SubtaskItem,
  type TaskCard,
  type TaskPriority,
  type TaskStatus,
  type WorkspaceView,
} from './types/pm';
import { useWebSocket } from './hooks/useWebSocket';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { FilterToolbar } from './components/FilterToolbar';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskListView } from './components/TaskListView';
import { MyTasksView } from './components/MyTasksView';
import { ActivityFeedView } from './components/ActivityFeedView';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import { NotificationPreferences } from './components/NotificationPreferences';
import {
  CreateProjectModal,
  CreateTaskModal,
  DependencyOverrideModal,
  JoinProjectModal,
  TeamInviteModal,
} from './components/Modals';
import { ToastContainer, type ToastItem } from './components/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';

const CalendarView = lazy(() =>
  import('./components/CalendarView').then((m) => ({ default: m.CalendarView }))
);
const TimelineView = lazy(() =>
  import('./components/TimelineView').then((m) => ({ default: m.TimelineView }))
);
const SprintBoard = lazy(() =>
  import('./components/SprintBoard').then((m) => ({ default: m.SprintBoard }))
);
const AnalyticsDashboard = lazy(() =>
  import('./components/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard }))
);
const TeamManagement = lazy(() =>
  import('./components/TeamManagement').then((m) => ({ default: m.TeamManagement }))
);
const ExportManager = lazy(() =>
  import('./components/ExportManager').then((m) => ({ default: m.ExportManager }))
);

function mapWsEventToNotifType(eventType: string): NotificationType {
  if (eventType === 'task:created') return 'task_assigned';
  if (eventType === 'task:moved') return 'task_moved';
  if (eventType === 'comment:added') return 'comment_added';
  if (eventType === 'member:joined') return 'member_joined';
  return 'task_status_changed';
}

function ViewFallback() {
  return (
    <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      {[0, 1, 2].map((idx) => (
        <div
          key={idx}
          className="h-56 glass-card animate-pulse"
        />
      ))}
    </div>
  );
}

function WorkspaceApp() {
  const [user, setUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationMsg, setVerificationMsg] = useState<string | null>(null);

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [memberships, setMemberships] = useState<ProjectMembership[]>([]);
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('cadence-active-project');
    } catch {
      return null;
    }
  });

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreference>(DEFAULT_NOTIFICATION_PREFS);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [customTemplates, setCustomTemplates] = useState<ProjectTemplate[]>([]);

  const [view, setView] = useState<WorkspaceView>('board');
  const [criteria, setCriteria] = useState<FilterCriteria>(DEFAULT_FILTER_CRITERIA);
  const [debouncedCriteria, setDebouncedCriteria] =
    useState<FilterCriteria>(DEFAULT_FILTER_CRITERIA);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [joinProjectOpen, setJoinProjectOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [notifPrefsOpen, setNotifPrefsOpen] = useState(false);
  const [newTaskModal, setNewTaskModal] = useState<{
    status: TaskStatus;
    dueDate?: string;
  } | null>(null);
  const [pendingOverrideMove, setPendingOverrideMove] = useState<{
    task: TaskCard;
    newStatus: TaskStatus;
    newPosition: number;
    blockers: TaskCard[];
  } | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const reminderSyncedRef = useRef<Set<string>>(new Set());

  const pushToast = useCallback((title: string, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [{ id, title, message }, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const handleRemotePush = useCallback(
    (ev: BoardActivityEvent) => {
      const notifType = mapWsEventToNotifType(ev.eventType);
      if (!shouldDeliverByPrefs(notifType, notifPrefs)) return;
      pushToast(ev.actorName || 'Workspace Update', ev.summary);
    },
    [notifPrefs, pushToast]
  );

  const {
    connected: wsConnected,
    presenceMembers,
    remoteDrags,
    liveFeed,
    emitDragStart,
    emitDragEnd,
    emitBoardEvent,
  } = useWebSocket({
    user: emailVerified ? user : null,
    projectId: emailVerified ? activeProjectId : null,
    onRemotePushNotification: handleRemotePush,
  });

  // Network connectivity listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Debounce search/filter changes for responsive rendering on large boards
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCriteria(criteria);
    }, 180);
    return () => clearTimeout(timer);
  }, [criteria]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setEmailVerified(Boolean(nextUser?.emailVerified));
      setAuthReady(true);
      setVerificationMsg(null);

      if (nextUser) {
        try {
          await syncUserProfile(nextUser);
          if (nextUser.emailVerified) {
            const prefs = await loadNotificationPreferences(nextUser.uid);
            setNotifPrefs(prefs);
          }
        } catch (err) {
          console.error('Failed to sync profile:', err);
        }
      } else {
        setMemberships([]);
        setMembershipsLoaded(false);
        setActiveProject(null);
        setMembers([]);
        setTasks([]);
        setSprints([]);
        setMilestones([]);
        setActivities([]);
        setNotifications([]);
        setSavedFilters([]);
        setCustomTemplates([]);
        setNotifPrefs(DEFAULT_NOTIFICATION_PREFS);
      }
    });
    return () => unsub();
  }, []);

  // User subcollections listeners (memberships, notifications, saved filters, templates)
  useEffect(() => {
    if (!authReady || !user || !emailVerified) return;

    const membershipsPath = `users/${user.uid}/projectMemberships`;
    const unsubMemberships = onSnapshot(
      query(collection(db, 'users', user.uid, 'projectMemberships'), orderBy('joinedAt', 'asc')),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as ProjectMembership);
        setMemberships(list);
        setMembershipsLoaded(true);
        setActiveProjectId((prev) => {
          if (prev && list.some((m) => m.projectId === prev)) return prev;
          return list[0]?.projectId ?? null;
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, membershipsPath)
    );

    const notifPath = `users/${user.uid}/notifications`;
    const unsubNotifications = onSnapshot(
      query(
        collection(db, 'users', user.uid, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(50)
      ),
      (snap) => {
        setNotifications(snap.docs.map((d) => d.data() as AppNotification));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, notifPath)
    );

    const filtersPath = `users/${user.uid}/savedFilters`;
    const unsubFilters = onSnapshot(
      query(collection(db, 'users', user.uid, 'savedFilters'), orderBy('createdAt', 'desc')),
      (snap) => {
        setSavedFilters(snap.docs.map((d) => d.data() as SavedFilter));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, filtersPath)
    );

    const templatesPath = `users/${user.uid}/templates`;
    const unsubTemplates = onSnapshot(
      query(collection(db, 'users', user.uid, 'templates'), orderBy('createdAt', 'desc')),
      (snap) => {
        const parsed: ProjectTemplate[] = [];
        for (const docSnap of snap.docs) {
          const data = docSnap.data() as { id: string; payloadJson?: string };
          if (!data.payloadJson) continue;
          try {
            const tpl = JSON.parse(data.payloadJson) as ProjectTemplate;
            parsed.push({ ...tpl, id: docSnap.id, isCustom: true });
          } catch {
            // Skip malformed template payload
          }
        }
        setCustomTemplates(parsed);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, templatesPath)
    );

    return () => {
      unsubMemberships();
      unsubNotifications();
      unsubFilters();
      unsubTemplates();
    };
  }, [authReady, user, emailVerified]);

  // Persist active project selection
  useEffect(() => {
    try {
      if (activeProjectId) {
        localStorage.setItem('cadence-active-project', activeProjectId);
      } else {
        localStorage.removeItem('cadence-active-project');
      }
    } catch {
      // ignore storage errors
    }
  }, [activeProjectId]);

  // Active project listeners (project doc, members, tasks, sprints, milestones, activities)
  useEffect(() => {
    if (!authReady || !user || !emailVerified || !activeProjectId) {
      setActiveProject(null);
      setMembers([]);
      setTasks([]);
      setSprints([]);
      setMilestones([]);
      setActivities([]);
      setTasksLoading(false);
      return;
    }

    setTasksLoading(true);

    const projectPath = `projects/${activeProjectId}`;
    const unsubProject = onSnapshot(
      doc(db, 'projects', activeProjectId),
      (snap) => {
        setActiveProject(snap.exists() ? (snap.data() as Project) : null);
      },
      (err) => handleFirestoreError(err, OperationType.GET, projectPath)
    );

    const membersPath = `projects/${activeProjectId}/members`;
    const unsubMembers = onSnapshot(
      collection(db, 'projects', activeProjectId, 'members'),
      (snap) => {
        setMembers(snap.docs.map((d) => d.data() as ProjectMember));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, membersPath)
    );

    const tasksPath = `projects/${activeProjectId}/tasks`;
    const unsubTasks = onSnapshot(
      query(collection(db, 'projects', activeProjectId, 'tasks'), orderBy('position', 'asc')),
      (snap) => {
        setTasks(snap.docs.map((d) => d.data() as TaskCard));
        setTasksLoading(false);
      },
      (err) => {
        setTasksLoading(false);
        handleFirestoreError(err, OperationType.LIST, tasksPath);
      }
    );

    const sprintsPath = `projects/${activeProjectId}/sprints`;
    const unsubSprints = onSnapshot(
      query(collection(db, 'projects', activeProjectId, 'sprints'), orderBy('startDate', 'asc')),
      (snap) => {
        setSprints(snap.docs.map((d) => d.data() as Sprint));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, sprintsPath)
    );

    const milestonesPath = `projects/${activeProjectId}/milestones`;
    const unsubMilestones = onSnapshot(
      query(collection(db, 'projects', activeProjectId, 'milestones'), orderBy('dueDate', 'asc')),
      (snap) => {
        setMilestones(snap.docs.map((d) => d.data() as Milestone));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, milestonesPath)
    );

    const activitiesPath = `projects/${activeProjectId}/activities`;
    const unsubActivities = onSnapshot(
      query(
        collection(db, 'projects', activeProjectId, 'activities'),
        orderBy('createdAt', 'desc'),
        limit(60)
      ),
      (snap) => {
        setActivities(snap.docs.map((d) => d.data() as ProjectActivity));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, activitiesPath)
    );

    return () => {
      unsubProject();
      unsubMembers();
      unsubTasks();
      unsubSprints();
      unsubMilestones();
      unsubActivities();
    };
  }, [authReady, user, emailVerified, activeProjectId]);

  // Sync due-soon and overdue deadline reminders once per project per day
  useEffect(() => {
    if (!user || !emailVerified || !activeProject || tasksLoading) return;
    const today = localTodayIso();
    const syncKey = `${activeProject.id}:${today}`;
    if (reminderSyncedRef.current.has(syncKey)) return;
    reminderSyncedRef.current.add(syncKey);

    syncDeadlineReminders({
      user,
      projectId: activeProject.id,
      projectName: activeProject.name,
      tasks,
      existingNotifications: notifications,
      prefs: notifPrefs,
    }).catch((err) => {
      console.warn('Deadline reminder sync skipped:', err);
    });
  }, [user, emailVerified, activeProject, tasks, tasksLoading, notifications, notifPrefs]);

  const currentUserRole: ProjectRole = useMemo(() => {
    if (!user) return 'member';
    const found = members.find((m) => m.uid === user.uid);
    return found?.role ?? 'member';
  }, [members, user]);

  const filteredTasks = useMemo(
    () => applyTaskFilters(tasks, debouncedCriteria, activeProject?.name ?? ''),
    [tasks, debouncedCriteria, activeProject?.name]
  );

  const overdueCount = useMemo(() => {
    const today = localTodayIso();
    return tasks.filter((t) => isOverdueTask(t, today)).length;
  }, [tasks]);

  const myTasksCount = useMemo(() => {
    if (!user) return 0;
    return tasks.filter(
      (t) => t.status !== 'done' && (t.assigneeUid === user.uid || t.createdBy === user.uid)
    ).length;
  }, [tasks, user]);

  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null),
    [tasks, selectedTaskId]
  );

  const handleCheckEmailVerification = async () => {
    if (!user) return;
    setVerificationBusy(true);
    setVerificationMsg(null);
    try {
      await user.reload();
      await user.getIdToken(true);
      const verifiedNow = Boolean(auth.currentUser?.emailVerified);
      setEmailVerified(verifiedNow);
      if (!verifiedNow) {
        setVerificationMsg(
          'Email is not marked verified yet. Click the link in your inbox, then refresh again.'
        );
      }
    } catch (err) {
      setVerificationMsg(err instanceof Error ? err.message : 'Unable to refresh verification.');
    } finally {
      setVerificationBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user) return;
    setVerificationBusy(true);
    setVerificationMsg(null);
    try {
      await sendEmailVerification(user);
      setVerificationMsg(`Verification link sent to ${user.email}. Check your inbox or spam folder.`);
    } catch (err) {
      setVerificationMsg(err instanceof Error ? err.message : 'Unable to send verification email.');
    } finally {
      setVerificationBusy(false);
    }
  };

  const handleCreateProject = async (data: {
    name: string;
    key: string;
    description: string;
    includeStarterTasks: boolean;
    template?: ProjectTemplate | null;
  }) => {
    if (!user) return;
    const projectId = await createProject({ ...data, user });
    setActiveProjectId(projectId);
    setView('board');
    pushToast('Project created', `${data.name} (${data.key}) is ready.`);
  };

  const handleJoinProject = async (inviteCode: string) => {
    if (!user) return;
    const joined = await joinProjectByInvite({ inviteCode, user });
    setActiveProjectId(joined.projectId);
    setView('board');
    emitBoardEvent({
      eventType: 'member:joined',
      summary: `${deriveDisplayName(user)} joined ${joined.projectName}`,
    });
    pushToast('Joined project', `You are now a member of ${joined.projectName}.`);
  };

  const handleCreateTask = async (data: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee: ProjectMember | null;
    tags: string[];
    dueDate: string;
    startDate: string;
    sprintId: string;
    milestoneId: string;
    estimatedMinutes: number;
  }) => {
    if (!user || !activeProject) return;
    const colTasks = tasks.filter((t) => t.status === data.status);
    const maxPos = colTasks.reduce((m, t) => Math.max(m, t.position), 0);

    const { taskId, taskKey } = await createTask({
      projectId: activeProject.id,
      projectName: activeProject.name,
      projectKey: activeProject.key,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      position: maxPos + 1000,
      assignee: data.assignee,
      tags: data.tags,
      dueDate: data.dueDate,
      startDate: data.startDate,
      sprintId: data.sprintId,
      milestoneId: data.milestoneId,
      estimatedMinutes: data.estimatedMinutes,
      user,
    });

    emitBoardEvent({
      eventType: 'task:created',
      taskId,
      taskKey,
      summary: `Created ${taskKey}: ${data.title}`,
      recipientUids: data.assignee ? [data.assignee.uid] : [],
    });
  };

  const commitTaskMove = useCallback(
    async (
      task: TaskCard,
      newStatus: TaskStatus,
      newPosition: number,
      overrideReason?: string
    ) => {
      if (!user || !activeProject) return;
      await moveTask({
        projectId: activeProject.id,
        taskId: task.id,
        status: newStatus,
        position: newPosition,
        overrideReason,
      });

      const targetLabel = BOARD_COLUMNS.find((c) => c.id === newStatus)?.label ?? newStatus;
      const statusChanged = task.status !== newStatus;
      const summary = overrideReason
        ? `Moved ${task.taskKey} to ${targetLabel} (Override: ${overrideReason})`
        : statusChanged
          ? `Moved ${task.taskKey} to ${targetLabel}`
          : `Reordered ${task.taskKey} in ${targetLabel}`;

      if (statusChanged) {
        await logProjectActivity({
          projectId: activeProject.id,
          user,
          action: overrideReason ? 'task:dependency_override' : 'task:moved',
          taskId: task.id,
          taskKey: task.taskKey,
          summary,
        });
      }

      const recipientUids =
        statusChanged && task.assigneeUid && task.assigneeUid !== user.uid
          ? [task.assigneeUid]
          : [];

      if (statusChanged && recipientUids.length > 0) {
        await sendNotification({
          recipientUid: task.assigneeUid,
          actorUid: user.uid,
          actorName: deriveDisplayName(user),
          projectId: activeProject.id,
          projectName: activeProject.name,
          taskId: task.id,
          taskKey: task.taskKey,
          type: newStatus === 'done' ? 'task_completed' : 'task_moved',
          message: `${deriveDisplayName(user)} moved ${task.taskKey} to ${targetLabel}`,
        });
      }

      if (statusChanged && newStatus === 'done' && task.recurrence?.active) {
        const nextTaskId = await generateNextRecurringTask({
          task,
          projectName: activeProject.name,
          projectKey: activeProject.key,
          members,
          user,
        });
        if (nextTaskId) {
          pushToast('Recurring task scheduled', `Created next occurrence for ${task.taskKey}.`);
        }
      }

      emitBoardEvent({
        eventType: 'task:moved',
        taskId: task.id,
        taskKey: task.taskKey,
        summary,
        recipientUids,
      });
    },
    [user, activeProject, members, emitBoardEvent, pushToast]
  );

  const handleMoveTask = async (
    task: TaskCard,
    newStatus: TaskStatus,
    newPosition: number
  ): Promise<boolean> => {
    if (!user || !activeProject) return false;
    const enteringActiveWork =
      task.status !== newStatus && (newStatus === 'in_progress' || newStatus === 'done');

    if (enteringActiveWork) {
      const blockers = getIncompleteBlockers(task, tasks);
      if (blockers.length > 0) {
        setPendingOverrideMove({ task, newStatus, newPosition, blockers });
        return false;
      }
    }

    await commitTaskMove(task, newStatus, newPosition);
    return true;
  };

  const handleSaveTaskDrawer = async (updates: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    position: number;
    assignee: ProjectMember | null;
    tags: string[];
    dueDate: string;
    startDate: string;
    sprintId: string;
    milestoneId: string;
    estimatedMinutes: number;
    subtasks: SubtaskItem[];
    blockedBy: string[];
    relatedTaskIds: string[];
    recurrence: RecurrenceConfig | null;
    overrideReason: string;
  }) => {
    if (!user || !activeProject || !selectedTask) return;
    await updateTask({
      projectId: activeProject.id,
      projectName: activeProject.name,
      taskId: selectedTask.id,
      taskKey: selectedTask.taskKey,
      previousAssigneeUid: selectedTask.assigneeUid,
      previousStatus: selectedTask.status,
      updates,
      actor: user,
    });

    if (
      selectedTask.status !== 'done' &&
      updates.status === 'done' &&
      updates.recurrence?.active
    ) {
      const nextId = await generateNextRecurringTask({
        task: { ...selectedTask, ...updates, recurrence: updates.recurrence },
        projectName: activeProject.name,
        projectKey: activeProject.key,
        members,
        user,
      });
      if (nextId) {
        pushToast('Recurring task scheduled', `Created next occurrence for ${selectedTask.taskKey}.`);
      }
    }

    emitBoardEvent({
      eventType: 'task:updated',
      taskId: selectedTask.id,
      taskKey: selectedTask.taskKey,
      summary: `Updated ${selectedTask.taskKey}: ${updates.title}`,
      recipientUids:
        updates.assignee && updates.assignee.uid !== selectedTask.assigneeUid
          ? [updates.assignee.uid]
          : [],
    });
  };

  const handleDeleteTask = async (task: TaskCard) => {
    if (!activeProject || !user) return;
    await deleteTask({
      projectId: activeProject.id,
      taskId: task.id,
      taskKey: task.taskKey,
      user,
    });
    emitBoardEvent({
      eventType: 'task:deleted',
      taskId: task.id,
      taskKey: task.taskKey,
      summary: `Deleted ${task.taskKey}: ${task.title}`,
    });
  };

  const handleAddComment = async (
    task: TaskCard,
    body: string,
    notifyUids: string[]
  ) => {
    if (!user || !activeProject) return;
    const { mentionedUids } = await addComment({
      projectId: activeProject.id,
      projectName: activeProject.name,
      taskId: task.id,
      taskKey: task.taskKey,
      body,
      members,
      user,
      notifyUids,
    });

    emitBoardEvent({
      eventType: 'comment:added',
      taskId: task.id,
      taskKey: task.taskKey,
      summary: `Commented on ${task.taskKey}: "${body.slice(0, 60)}"`,
      recipientUids: Array.from(new Set([...notifyUids, ...mentionedUids])),
    });
  };

  const handleUpdateComment = async (taskId: string, commentId: string, body: string) => {
    if (!activeProject) return;
    await updateComment({
      projectId: activeProject.id,
      taskId,
      commentId,
      body,
      members,
    });
  };

  const handleDeleteComment = async (taskId: string, commentId: string) => {
    if (!activeProject) return;
    await deleteComment({ projectId: activeProject.id, taskId, commentId });
  };

  const handleBulkUpdate = async (
    selectedTasks: TaskCard[],
    updates: {
      status?: TaskStatus;
      priority?: TaskPriority;
      assignee?: ProjectMember | null;
    }
  ) => {
    if (!activeProject || !user) return;
    await bulkUpdateTasks({ projectId: activeProject.id, tasks: selectedTasks, updates });
    await logProjectActivity({
      projectId: activeProject.id,
      user,
      action: 'tasks:bulk_updated',
      summary: `Bulk updated ${selectedTasks.length} tasks`,
    });
    pushToast('Tasks updated', `Updated ${selectedTasks.length} selected tasks.`);
  };

  const handleBulkDelete = async (taskIds: string[]) => {
    if (!activeProject || !user) return;
    await bulkDeleteTasks({ projectId: activeProject.id, taskIds });
    await logProjectActivity({
      projectId: activeProject.id,
      user,
      action: 'tasks:bulk_deleted',
      summary: `Deleted ${taskIds.length} tasks in bulk`,
    });
    pushToast('Tasks deleted', `Removed ${taskIds.length} tasks.`);
  };

  const handleRescheduleTask = async (task: TaskCard, newDueDate: string) => {
    if (!activeProject || !user) return;
    const startDate = task.startDate && task.startDate <= newDueDate ? task.startDate : '';
    await updateTaskDates({
      projectId: activeProject.id,
      taskId: task.id,
      startDate,
      dueDate: newDueDate,
    });
    await logProjectActivity({
      projectId: activeProject.id,
      user,
      action: 'task:rescheduled',
      taskId: task.id,
      taskKey: task.taskKey,
      summary: `Rescheduled ${task.taskKey} due date to ${newDueDate}`,
    });
  };

  const handleUpdateTimelineDates = async (
    task: TaskCard,
    startDate: string,
    dueDate: string
  ) => {
    if (!activeProject || !user) return;
    await updateTaskDates({
      projectId: activeProject.id,
      taskId: task.id,
      startDate,
      dueDate,
    });
    await logProjectActivity({
      projectId: activeProject.id,
      user,
      action: 'task:timeline_updated',
      taskId: task.id,
      taskKey: task.taskKey,
      summary: `Updated ${task.taskKey} timeline (${startDate || '—'} → ${dueDate || '—'})`,
    });
  };

  const handleGenerateNextRecurrence = async (task: TaskCard) => {
    if (!activeProject || !user) return;
    const nextId = await generateNextRecurringTask({
      task,
      projectName: activeProject.name,
      projectKey: activeProject.key,
      members,
      user,
    });
    if (nextId) {
      pushToast('Recurring instance created', `Scheduled next occurrence from ${task.taskKey}.`);
    } else {
      pushToast('Recurrence completed', `${task.taskKey} reached its end date.`);
    }
  };

  const handleSaveAsTemplate = async (templateName: string, category: string) => {
    if (!user || !activeProject) return;
    const tpl = buildTemplateFromProject({
      project: activeProject,
      tasks,
      milestones,
      templateName,
      category,
    });
    await saveCustomTemplate({ uid: user.uid, template: tpl });
    pushToast('Template saved', `${tpl.name} is now available under New Project.`);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center cadence-canvas text-[#795D6B] dark:text-[#D9B7C4]">
        <div className="glass-card px-5 py-3 text-xs font-semibold text-[#7A2346] dark:text-[#F1BBC8]">
          Loading Cadence workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 cadence-canvas text-[#3D1023] dark:text-[#FFF5F6]">
        <div className="max-w-md w-full p-7 glass-strong rounded-[20px] space-y-5 text-center">
          <div className="w-12 h-12 rounded-[16px] bg-[#FCE8EC] dark:bg-[#8F3157]/40 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 text-[#7A2346] dark:text-[#F1BBC8] flex items-center justify-center mx-auto">
            <MailCheck className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-xl font-bold text-[#3D1023] dark:text-[#FFF5F6]">
              Verify your email to unlock workspace
            </h1>
            <p className="text-xs text-[#513443] dark:text-[#D9B7C4] leading-relaxed">
              Cadence requires a verified email address before accessing shared projects and real-time boards. Check{' '}
              <strong className="text-[#7A2346] dark:text-[#F1BBC8]">{user.email}</strong> for your verification link.
            </p>
          </div>

          {verificationMsg && (
            <div className="p-3 rounded-[12px] border border-[#C86B88]/35 bg-[#FCE8EC]/80 dark:bg-[#5B1733]/60 text-xs text-[#5B1733] dark:text-[#F8DDE3]">
              {verificationMsg}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={verificationBusy}
              onClick={handleCheckEmailVerification}
              className="btn-burgundy inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verificationBusy ? 'animate-spin' : ''}`} />
              <span>I&apos;ve Verified — Continue to Workspace</span>
            </button>

            <button
              type="button"
              disabled={verificationBusy}
              onClick={handleResendVerification}
              className="btn-blush px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Resend Verification Email
            </button>

            <button
              type="button"
              onClick={() => signOut(auth)}
              className="px-4 py-2 text-xs font-medium text-[#795D6B] hover:text-[#7A2346] dark:text-[#D9B7C4] dark:hover:text-white cursor-pointer"
            >
              Sign out and switch account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showFilterBar =
    view === 'board' || view === 'list' || view === 'calendar' || view === 'timeline';

  return (
    <div className="h-screen flex overflow-hidden cadence-canvas text-[#3D1023] dark:text-[#FFF5F6]">
      <Sidebar
        user={user}
        memberships={memberships}
        activeProjectId={activeProjectId}
        activeView={view}
        overdueCount={overdueCount}
        myTasksCount={myTasksCount}
        onSelectView={setView}
        onSelectProject={(pid) => {
          setActiveProjectId(pid);
          setSelectedTaskId(null);
          setCriteria(DEFAULT_FILTER_CRITERIA);
        }}
        onOpenNewProject={() => setNewProjectOpen(true)}
        onOpenJoinProject={() => setJoinProjectOpen(true)}
        onSignOut={() => signOut(auth)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopBar
          project={activeProject}
          wsConnected={wsConnected}
          isOnline={isOnline}
          presenceMembers={presenceMembers}
          notifications={notifications}
          searchQuery={criteria.search}
          onChangeSearch={(q) => setCriteria((prev) => ({ ...prev, search: q }))}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenTeamModal={() => setTeamModalOpen(true)}
          onOpenNewTaskModal={() => setNewTaskModal({ status: 'todo' })}
          onMarkNotificationRead={(id) =>
            markNotificationRead({ uid: user.uid, notificationId: id })
          }
          onMarkAllRead={() =>
            markAllNotificationsRead({
              uid: user.uid,
              notificationIds: notifications.filter((n) => !n.read).map((n) => n.id),
            })
          }
          onDeleteNotification={(id) =>
            deleteNotification({ uid: user.uid, notificationId: id })
          }
          onSelectTaskFromNotification={(pid, tid) => {
            setActiveProjectId(pid);
            if (tid) setSelectedTaskId(tid);
          }}
          onOpenNotificationPreferences={() => setNotifPrefsOpen(true)}
        />

        {!membershipsLoaded ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-6xl">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-64 glass-card animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : memberships.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full p-8 glass-strong rounded-[20px] text-center space-y-5">
              <div className="w-12 h-12 rounded-[16px] bg-[#FCE8EC] dark:bg-[#8F3157]/40 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 text-[#7A2346] dark:text-[#F1BBC8] flex items-center justify-center mx-auto">
                <FolderKanban className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-lg font-bold text-[#3D1023] dark:text-[#FFF5F6]">
                  Create or join your first project
                </h2>
                <p className="text-xs text-[#513443] dark:text-[#D9B7C4] leading-relaxed">
                  Launch a Kanban board from curated engineering, web, academic, or event templates, or enter a teammate&apos;s invite code.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                <button
                  type="button"
                  onClick={() => setNewProjectOpen(true)}
                  className="btn-burgundy inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Project</span>
                </button>
                <button
                  type="button"
                  onClick={() => setJoinProjectOpen(true)}
                  className="btn-blush inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Join via Invite</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {showFilterBar && activeProject && (
              <FilterToolbar
                view={view}
                onChangeView={setView}
                criteria={criteria}
                onChangeCriteria={setCriteria}
                members={members}
                sprints={sprints}
                tasks={tasks}
                uid={user.uid}
                projectId={activeProject.id}
                savedFilters={savedFilters}
                onOpenTeamModal={() => setTeamModalOpen(true)}
              />
            )}

            {tasksLoading ? (
              <div className="flex-1 p-6 flex gap-4 overflow-hidden">
                {[0, 1, 2, 3].map((col) => (
                  <div
                    key={col}
                    className="w-[300px] shrink-0 h-80 glass-card animate-pulse"
                  />
                ))}
              </div>
            ) : view === 'board' ? (
              <KanbanBoard
                tasks={filteredTasks}
                allTasks={tasks}
                remoteDrags={remoteDrags}
                onSelectTask={(t) => setSelectedTaskId(t.id)}
                onQuickCreate={(status) => setNewTaskModal({ status })}
                onMoveTask={handleMoveTask}
                onDragStartSignal={emitDragStart}
                onDragEndSignal={emitDragEnd}
              />
            ) : view === 'list' ? (
              <TaskListView
                tasks={filteredTasks}
                members={members}
                currentUserRole={currentUserRole}
                onSelectTask={(t) => setSelectedTaskId(t.id)}
                onQuickStatusChange={(t, nextStatus) =>
                  handleMoveTask(t, nextStatus, t.position)
                }
                onBulkUpdate={handleBulkUpdate}
                onBulkDelete={handleBulkDelete}
                onOpenNewTask={() => setNewTaskModal({ status: 'todo' })}
              />
            ) : view === 'calendar' ? (
              <Suspense fallback={<ViewFallback />}>
                <CalendarView
                  tasks={filteredTasks}
                  onSelectTask={(t) => setSelectedTaskId(t.id)}
                  onRescheduleTask={handleRescheduleTask}
                  onQuickCreateOnDate={(dateIso) =>
                    setNewTaskModal({ status: 'todo', dueDate: dateIso })
                  }
                />
              </Suspense>
            ) : view === 'timeline' ? (
              <Suspense fallback={<ViewFallback />}>
                <TimelineView
                  tasks={filteredTasks}
                  milestones={milestones}
                  onSelectTask={(t) => setSelectedTaskId(t.id)}
                  onUpdateDates={handleUpdateTimelineDates}
                />
              </Suspense>
            ) : view === 'my_tasks' || view === 'overdue' ? (
              <MyTasksView
                mode={view}
                user={user}
                tasks={filteredTasks}
                onSelectTask={(t) => setSelectedTaskId(t.id)}
                onQuickStatusChange={(t, nextStatus) =>
                  handleMoveTask(t, nextStatus, t.position)
                }
                onOpenNewTask={() => setNewTaskModal({ status: 'todo' })}
              />
            ) : view === 'sprints' && activeProject ? (
              <Suspense fallback={<ViewFallback />}>
                <SprintBoard
                  projectId={activeProject.id}
                  sprints={sprints}
                  milestones={milestones}
                  tasks={tasks}
                  user={user}
                  role={currentUserRole}
                  onSelectTask={(t) => setSelectedTaskId(t.id)}
                />
              </Suspense>
            ) : view === 'analytics' ? (
              <Suspense fallback={<ViewFallback />}>
                <AnalyticsDashboard
                  memberships={memberships}
                  tasks={tasks}
                  members={members}
                  sprints={sprints}
                />
              </Suspense>
            ) : view === 'team' && activeProject ? (
              <Suspense fallback={<ViewFallback />}>
                <TeamManagement
                  project={activeProject}
                  members={members}
                  tasks={tasks}
                  milestones={milestones}
                  presenceMembers={presenceMembers}
                  currentUser={user}
                  currentUserRole={currentUserRole}
                  onCreateInvite={(params) =>
                    createProjectInvite({
                      projectId: activeProject.id,
                      projectName: activeProject.name,
                      projectKey: activeProject.key,
                      ...params,
                      user,
                    })
                  }
                  onRevokeInvite={(code) =>
                    revokeProjectInvite({ projectId: activeProject.id, code, user })
                  }
                  onUpdateRole={(memberUid, role) =>
                    updateMemberRole({
                      projectId: activeProject.id,
                      memberUid,
                      role,
                      actor: user,
                    })
                  }
                  onRemoveMember={(memberUid, memberName) =>
                    removeMember({
                      projectId: activeProject.id,
                      memberUid,
                      memberName,
                      actor: user,
                    })
                  }
                  onUpdateProjectDetails={(name, description) =>
                    updateProjectDetails({
                      projectId: activeProject.id,
                      name,
                      description,
                      user,
                    })
                  }
                  onSaveAsTemplate={handleSaveAsTemplate}
                />
              </Suspense>
            ) : view === 'export' && activeProject ? (
              <Suspense fallback={<ViewFallback />}>
                <ExportManager
                  project={activeProject}
                  members={members}
                  tasks={tasks}
                  sprints={sprints}
                />
              </Suspense>
            ) : (
              <ActivityFeedView
                wsConnected={wsConnected}
                presenceMembers={presenceMembers}
                events={liveFeed}
                persistedActivities={activities}
                onSelectTask={(taskId) => setSelectedTaskId(taskId)}
              />
            )}
          </>
        )}
      </div>

      {activeProject && selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          allTasks={tasks}
          sprints={sprints}
          milestones={milestones}
          activities={activities}
          projectId={activeProject.id}
          projectName={activeProject.name}
          members={members}
          currentUser={user}
          currentUserRole={currentUserRole}
          onClose={() => setSelectedTaskId(null)}
          onSelectOtherTask={(id) => setSelectedTaskId(id)}
          onSaveTask={handleSaveTaskDrawer}
          onDeleteTask={handleDeleteTask}
          onGenerateNextRecurrence={handleGenerateNextRecurrence}
          onAddComment={handleAddComment}
          onUpdateComment={handleUpdateComment}
          onDeleteComment={handleDeleteComment}
        />
      )}

      {newProjectOpen && (
        <CreateProjectModal
          customTemplates={customTemplates}
          onDeleteCustomTemplate={(templateId) =>
            deleteCustomTemplate({ uid: user.uid, templateId })
          }
          onClose={() => setNewProjectOpen(false)}
          onSubmit={handleCreateProject}
        />
      )}

      {joinProjectOpen && (
        <JoinProjectModal
          onClose={() => setJoinProjectOpen(false)}
          onSubmit={handleJoinProject}
        />
      )}

      {newTaskModal && activeProject && (
        <CreateTaskModal
          initialStatus={newTaskModal.status}
          initialDueDate={newTaskModal.dueDate}
          members={members}
          sprints={sprints}
          milestones={milestones}
          onClose={() => setNewTaskModal(null)}
          onSubmit={handleCreateTask}
        />
      )}

      {teamModalOpen && activeProject && (
        <TeamInviteModal
          project={activeProject}
          members={members}
          currentUser={user}
          currentUserRole={currentUserRole}
          onClose={() => setTeamModalOpen(false)}
          onOpenFullTeamView={() => setView('team')}
          onCreateInvite={(params) =>
            createProjectInvite({
              projectId: activeProject.id,
              projectName: activeProject.name,
              projectKey: activeProject.key,
              ...params,
              user,
            })
          }
          onUpdateRole={(memberUid, role) =>
            updateMemberRole({
              projectId: activeProject.id,
              memberUid,
              role,
              actor: user,
            })
          }
          onRemoveMember={(memberUid) =>
            removeMember({ projectId: activeProject.id, memberUid, actor: user })
          }
        />
      )}

      {pendingOverrideMove && (
        <DependencyOverrideModal
          task={pendingOverrideMove.task}
          blockers={pendingOverrideMove.blockers}
          canOverride={currentUserRole === 'owner' || currentUserRole === 'admin'}
          onCancel={() => setPendingOverrideMove(null)}
          onConfirmOverride={async (reason) => {
            const pending = pendingOverrideMove;
            setPendingOverrideMove(null);
            await commitTaskMove(pending.task, pending.newStatus, pending.newPosition, reason);
          }}
        />
      )}

      {notifPrefsOpen && (
        <NotificationPreferences
          uid={user.uid}
          onClose={() => setNotifPrefsOpen(false)}
          onSaved={(prefs) => {
            setNotifPrefs(prefs);
            pushToast('Preferences saved', 'Notification settings updated.');
          }}
        />
      )}

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceApp />
    </ErrorBoundary>
  );
}
