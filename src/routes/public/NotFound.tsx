import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="bg-stage flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-accent">404 · not found</p>
      <h1 className="heading-display mt-4 text-5xl md:text-7xl">
        Off the runway.
      </h1>
      <p className="mt-4 max-w-md text-fg-soft">
        This page either hasn't shipped yet or quietly retired. Head back to the
        launch hub or jump into the operator console.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/" className="btn-primary">
          Back to launch
        </Link>
        <Link to="/ops" className="btn-ghost">
          Operator console
        </Link>
      </div>
    </main>
  );
}
