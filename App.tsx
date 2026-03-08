import './src/i18n';
import { StatusBar } from 'expo-status-bar';
import AppShell from './src/app/AppShell';

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <AppShell />
    </>
  );
}
