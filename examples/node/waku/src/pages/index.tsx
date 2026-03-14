import { DebuggerTest } from '../components/debugger-test';

export default async function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 24px" }}>Waku — Debugger Test</h1>
      <DebuggerTest />
    </main>
  );
}

export const getConfig = async () => {
  return {
    render: 'dynamic',
  } as const;
};
