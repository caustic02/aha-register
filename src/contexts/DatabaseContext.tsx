import React, { createContext, useContext } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';

const DatabaseContext = createContext<SQLiteDatabase | null>(null);

export function DatabaseProvider({
  db,
  children,
}: {
  db: SQLiteDatabase;
  children: React.ReactNode;
}) {
  return (
    <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>
  );
}

export function useDatabase(): SQLiteDatabase {
  const db = useContext(DatabaseContext);
  if (!db) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return db;
}
