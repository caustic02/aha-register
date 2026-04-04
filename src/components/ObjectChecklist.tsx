import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckSquare, Square, Plus, ListChecks } from 'lucide-react-native';
import { useDatabase } from '../contexts/DatabaseContext';
import { generateId } from '../utils/uuid';
import { radii, spacing, touch, typography } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import type { ObjectTask } from '../db/types';

const DEFAULT_TASKS = [
  'Capture all 6 views',
  'Run AI analysis',
  'Enter dimensions',
  'Set location',
  'Export PDF',
];

interface Props {
  objectId: string;
  viewCount?: number;
  hasAI?: boolean;
}

export function ObjectChecklist({ objectId, viewCount = 0, hasAI = false }: Props) {
  const db = useDatabase();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [tasks, setTasks] = useState<ObjectTask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    const rows = await db.getAllAsync<ObjectTask>(
      'SELECT * FROM object_tasks WHERE object_id = ? ORDER BY sort_order, created_at',
      [objectId],
    );

    // If no tasks exist, seed defaults
    if (rows.length === 0) {
      const now = new Date().toISOString();
      for (let i = 0; i < DEFAULT_TASKS.length; i++) {
        const id = generateId();
        await db.runAsync(
          'INSERT INTO object_tasks (id, object_id, title, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
          [id, objectId, DEFAULT_TASKS[i], i, now],
        );
      }
      const seeded = await db.getAllAsync<ObjectTask>(
        'SELECT * FROM object_tasks WHERE object_id = ? ORDER BY sort_order, created_at',
        [objectId],
      );
      setTasks(seeded);
    } else {
      setTasks(rows);
    }
    setLoading(false);
  }, [db, objectId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Auto-check based on actual state
  useEffect(() => {
    if (loading || tasks.length === 0) return;

    (async () => {
      const now = new Date().toISOString();
      for (const task of tasks) {
        let shouldComplete = false;
        if (task.title === 'Capture all 6 views' && viewCount >= 6 && task.completed === 0) {
          shouldComplete = true;
        }
        if (task.title === 'Run AI analysis' && hasAI && task.completed === 0) {
          shouldComplete = true;
        }
        if (shouldComplete) {
          await db.runAsync(
            'UPDATE object_tasks SET completed = 1, completed_at = ? WHERE id = ?',
            [now, task.id],
          );
        }
      }
      // Reload if any auto-checks happened
      const updated = await db.getAllAsync<ObjectTask>(
        'SELECT * FROM object_tasks WHERE object_id = ? ORDER BY sort_order, created_at',
        [objectId],
      );
      setTasks(updated);
    })();
  }, [viewCount, hasAI, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTask = useCallback(
    async (taskId: string, currentCompleted: number) => {
      const now = new Date().toISOString();
      if (currentCompleted === 0) {
        await db.runAsync(
          'UPDATE object_tasks SET completed = 1, completed_at = ? WHERE id = ?',
          [now, taskId],
        );
      } else {
        await db.runAsync(
          'UPDATE object_tasks SET completed = 0, completed_at = NULL WHERE id = ?',
          [taskId],
        );
      }
      const updated = await db.getAllAsync<ObjectTask>(
        'SELECT * FROM object_tasks WHERE object_id = ? ORDER BY sort_order, created_at',
        [objectId],
      );
      setTasks(updated);
    },
    [db, objectId],
  );

  const addTask = useCallback(async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const id = generateId();
    const maxOrder = tasks.length > 0 ? Math.max(...tasks.map((t) => t.sort_order)) + 1 : 0;
    await db.runAsync(
      'INSERT INTO object_tasks (id, object_id, title, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, objectId, trimmed, maxOrder, new Date().toISOString()],
    );
    setNewTitle('');
    const updated = await db.getAllAsync<ObjectTask>(
      'SELECT * FROM object_tasks WHERE object_id = ? ORDER BY sort_order, created_at',
      [objectId],
    );
    setTasks(updated);
  }, [db, objectId, newTitle, tasks]);

  const completedCount = tasks.filter((t) => t.completed === 1).length;

  if (loading) return null;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <ListChecks size={16} color={colors.heroGreen} />
          <Text style={s.headerTitle}>Checklist</Text>
        </View>
        <Text style={s.progress}>
          {completedCount}/{tasks.length} complete
        </Text>
      </View>

      {/* Progress bar */}
      <View style={s.progressBar}>
        {/* eslint-disable react-native/no-inline-styles */}
        <View
          style={[
            s.progressFill,
            { width: tasks.length > 0 ? `${(completedCount / tasks.length) * 100}%` : '0%' },
          ]}
        />
        {/* eslint-enable react-native/no-inline-styles */}
      </View>

      {/* Task list */}
      <View style={s.list}>
        {tasks.map((task) => (
          <Pressable
            key={task.id}
            style={s.taskRow}
            onPress={() => toggleTask(task.id, task.completed)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.completed === 1 }}
            accessibilityLabel={task.title}
          >
            {task.completed === 1 ? (
              <CheckSquare size={18} color={colors.heroGreen} />
            ) : (
              <Square size={18} color={colors.border} />
            )}
            <Text
              style={[
                s.taskTitle,
                task.completed === 1 && s.taskCompleted,
              ]}
            >
              {task.title}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Add task */}
      <View style={s.addRow}>
        <TextInput
          style={s.addInput}
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="Add a task..."
          placeholderTextColor={colors.textTertiary}
          onSubmitEditing={addTask}
          returnKeyType="done"
        />
        <Pressable
          style={[s.addBtn, !newTitle.trim() && s.addBtnDisabled]}
          onPress={addTask}
          disabled={!newTitle.trim()}
          accessibilityLabel="Add task"
          accessibilityRole="button"
        >
          <Plus size={16} color={newTitle.trim() ? colors.heroGreen : colors.textTertiary} />
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      backgroundColor: c.surfaceElevated,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerTitle: {
      fontSize: 14,
      fontWeight: typography.weight.semibold,
      color: c.text,
    },
    progress: {
      fontSize: 12,
      color: c.textSecondary,
      fontWeight: typography.weight.medium,
    },
    progressBar: {
      height: 3,
      backgroundColor: c.border,
      marginHorizontal: spacing.lg,
      borderRadius: 2,
      marginBottom: spacing.sm,
    },
    progressFill: {
      height: 3,
      backgroundColor: c.heroGreen,
      borderRadius: 2,
    },
    list: {
      paddingHorizontal: spacing.md,
    },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 8,
      paddingHorizontal: spacing.sm,
      minHeight: 40,
    },
    taskTitle: {
      fontSize: 13,
      color: c.text,
      flex: 1,
    },
    taskCompleted: {
      textDecorationLine: 'line-through',
      color: c.textTertiary,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.lg,
    },
    addInput: {
      flex: 1,
      fontSize: 13,
      color: c.text,
      paddingVertical: 10,
      minHeight: touch.minTarget,
    },
    addBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: touch.minTarget,
      minHeight: touch.minTarget,
    },
    addBtnDisabled: {
      opacity: 0.4,
    },
  });
}
