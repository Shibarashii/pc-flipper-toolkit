import { Link, Route, Routes } from "react-router";
import { BuildDetail } from "./pages/BuildDetail";
import { BuildsList } from "./pages/BuildsList";

export default function App() {
  return (
    <>
      <header className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-10">
        <Link to="/" className="font-serif text-xl font-medium">
          PC Flipper Toolkit
        </Link>
        <span className="text-[13px] font-medium text-muted">Builds</span>
      </header>
      <Routes>
        <Route path="/" element={<BuildsList />} />
        <Route path="/builds/:id" element={<BuildDetail />} />
      </Routes>
    </>
  );
}
