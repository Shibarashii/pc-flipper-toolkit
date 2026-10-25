import { BuildsList } from "./pages/BuildsList";

export default function App() {
  return (
    <>
      <header className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-10">
        <span className="font-serif text-xl font-medium">
          PC Flipper Toolkit
        </span>
        <span className="text-[13px] font-medium text-muted">Builds</span>
      </header>
      <BuildsList />
    </>
  );
}
