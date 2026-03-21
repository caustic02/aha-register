/**
 * State machine hook for managing the capture protocol flow.
 *
 * Drives the guided capture experience: protocol selection → sequential
 * shot capture → review → save. Supports skipping, retaking, and
 * saving incomplete documentation.
 */

import { useCallback, useMemo, useReducer } from 'react';
import {
  getProtocol,
  type CaptureProtocol,
  type ProtocolShot,
} from '../config/protocols';

// ── Public types ─────────────────────────────────────────────────────────────

export type ProtocolState = 'idle' | 'selecting' | 'capturing' | 'reviewing' | 'complete';

interface ShotCapture {
  uri: string;
  timestamp: string;
}

interface Progress {
  completed: number;
  total: number;
  required: number;
  requiredCompleted: number;
}

export interface UseCaptureProtocolReturn {
  // State
  state: ProtocolState;
  protocol: CaptureProtocol | null;
  currentShot: ProtocolShot | null;
  currentShotIndex: number;
  completedShots: Map<string, ShotCapture>;
  skippedShots: Set<string>;
  progress: Progress;
  isComplete: boolean;
  canSave: boolean;
  hasIncompleteRequired: boolean;

  // Actions
  selectProtocol: (id: string) => void;
  clearProtocol: () => void;
  captureShot: (shotId: string, uri: string) => void;
  skipShot: (shotId: string) => void;
  retakeShot: (shotId: string) => void;
  goToShot: (shotId: string) => void;
  startReview: () => void;
  reset: () => void;
}

// ── Reducer ──────────────────────────────────────────────────────────────────

interface ReducerState {
  state: ProtocolState;
  protocolId: string | null;
  currentShotId: string | null;
  completedShots: Map<string, ShotCapture>;
  skippedShots: Set<string>;
}

type Action =
  | { type: 'SELECT_PROTOCOL'; protocolId: string }
  | { type: 'CLEAR_PROTOCOL' }
  | { type: 'CAPTURE_SHOT'; shotId: string; uri: string }
  | { type: 'SKIP_SHOT'; shotId: string }
  | { type: 'RETAKE_SHOT'; shotId: string }
  | { type: 'GO_TO_SHOT'; shotId: string }
  | { type: 'START_REVIEW' }
  | { type: 'RESET' };

const initialState: ReducerState = {
  state: 'idle',
  protocolId: null,
  currentShotId: null,
  completedShots: new Map(),
  skippedShots: new Set(),
};

function getNextShotId(protocol: CaptureProtocol, completedShots: Map<string, ShotCapture>, skippedShots: Set<string>): string | null {
  const sorted = [...protocol.shots].sort((a, b) => a.order - b.order);
  for (const shot of sorted) {
    if (!completedShots.has(shot.id) && !skippedShots.has(shot.id)) {
      return shot.id;
    }
  }
  return null;
}

function reducer(state: ReducerState, action: Action): ReducerState {
  switch (action.type) {
    case 'SELECT_PROTOCOL': {
      const protocol = getProtocol(action.protocolId);
      if (!protocol) return state;
      const sorted = [...protocol.shots].sort((a, b) => a.order - b.order);
      return {
        state: 'capturing',
        protocolId: action.protocolId,
        currentShotId: sorted[0]?.id ?? null,
        completedShots: new Map(),
        skippedShots: new Set(),
      };
    }

    case 'CLEAR_PROTOCOL':
      return { ...initialState };

    case 'CAPTURE_SHOT': {
      const protocol = state.protocolId ? getProtocol(state.protocolId) : null;
      if (!protocol) return state;
      const newCompleted = new Map(state.completedShots);
      newCompleted.set(action.shotId, { uri: action.uri, timestamp: new Date().toISOString() });
      const newSkipped = new Set(state.skippedShots);
      newSkipped.delete(action.shotId);
      const nextShotId = getNextShotId(protocol, newCompleted, newSkipped);
      return {
        ...state,
        completedShots: newCompleted,
        skippedShots: newSkipped,
        currentShotId: nextShotId,
        state: nextShotId ? 'capturing' : 'reviewing',
      };
    }

    case 'SKIP_SHOT': {
      const protocol = state.protocolId ? getProtocol(state.protocolId) : null;
      if (!protocol) return state;
      const newSkipped = new Set(state.skippedShots);
      newSkipped.add(action.shotId);
      const nextShotId = getNextShotId(protocol, state.completedShots, newSkipped);
      return {
        ...state,
        skippedShots: newSkipped,
        currentShotId: nextShotId,
        state: nextShotId ? 'capturing' : 'reviewing',
      };
    }

    case 'RETAKE_SHOT': {
      const newCompleted = new Map(state.completedShots);
      newCompleted.delete(action.shotId);
      const newSkipped = new Set(state.skippedShots);
      newSkipped.delete(action.shotId);
      return {
        ...state,
        state: 'capturing',
        completedShots: newCompleted,
        skippedShots: newSkipped,
        currentShotId: action.shotId,
      };
    }

    case 'GO_TO_SHOT':
      return {
        ...state,
        state: 'capturing',
        currentShotId: action.shotId,
      };

    case 'START_REVIEW':
      return {
        ...state,
        state: 'reviewing',
        currentShotId: null,
      };

    case 'RESET':
      return { ...initialState };

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCaptureProtocol(): UseCaptureProtocolReturn {
  const [state, dispatch] = useReducer(reducer, initialState);

  const protocol = useMemo(
    () => (state.protocolId ? getProtocol(state.protocolId) : null),
    [state.protocolId],
  );

  const currentShot = useMemo(() => {
    if (!protocol || !state.currentShotId) return null;
    return protocol.shots.find((s) => s.id === state.currentShotId) ?? null;
  }, [protocol, state.currentShotId]);

  const currentShotIndex = useMemo(() => {
    if (!protocol || !state.currentShotId) return -1;
    const sorted = [...protocol.shots].sort((a, b) => a.order - b.order);
    return sorted.findIndex((s) => s.id === state.currentShotId);
  }, [protocol, state.currentShotId]);

  const progress = useMemo((): Progress => {
    if (!protocol) return { completed: 0, total: 0, required: 0, requiredCompleted: 0 };
    const requiredShots = protocol.shots.filter((s) => s.required);
    const requiredCompleted = requiredShots.filter((s) => state.completedShots.has(s.id)).length;
    return {
      completed: state.completedShots.size,
      total: protocol.shots.length,
      required: requiredShots.length,
      requiredCompleted,
    };
  }, [protocol, state.completedShots]);

  const isComplete = useMemo(() => {
    if (!protocol) return false;
    return progress.requiredCompleted >= progress.required;
  }, [protocol, progress]);

  const canSave = useMemo(() => {
    if (!protocol) return false;
    if (protocol.completion_rules.allow_incomplete_save) return state.completedShots.size > 0;
    return isComplete;
  }, [protocol, state.completedShots.size, isComplete]);

  const hasIncompleteRequired = useMemo(() => {
    if (!protocol) return false;
    return progress.requiredCompleted < progress.required;
  }, [protocol, progress]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const selectProtocol = useCallback((id: string) => {
    dispatch({ type: 'SELECT_PROTOCOL', protocolId: id });
  }, []);

  const clearProtocol = useCallback(() => {
    dispatch({ type: 'CLEAR_PROTOCOL' });
  }, []);

  const captureShot = useCallback((shotId: string, uri: string) => {
    dispatch({ type: 'CAPTURE_SHOT', shotId, uri });
  }, []);

  const skipShot = useCallback((shotId: string) => {
    dispatch({ type: 'SKIP_SHOT', shotId });
  }, []);

  const retakeShot = useCallback((shotId: string) => {
    dispatch({ type: 'RETAKE_SHOT', shotId });
  }, []);

  const goToShot = useCallback((shotId: string) => {
    dispatch({ type: 'GO_TO_SHOT', shotId });
  }, []);

  const startReview = useCallback(() => {
    dispatch({ type: 'START_REVIEW' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state: state.state,
    protocol,
    currentShot,
    currentShotIndex,
    completedShots: state.completedShots,
    skippedShots: state.skippedShots,
    progress,
    isComplete,
    canSave,
    hasIncompleteRequired,
    selectProtocol,
    clearProtocol,
    captureShot,
    skipShot,
    retakeShot,
    goToShot,
    startReview,
    reset,
  };
}
