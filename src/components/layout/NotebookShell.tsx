import { Outlet } from 'react-router-dom';
import './NotebookShell.css';
import { SidebarNav } from './SidebarNav';

export function NotebookShell() {
  return (
    <div className="notebook-shell">
      <aside className="notebook-sidebar">
        <div className="notebook-sidebar__brand">
          <span className="notebook-sidebar__icon" aria-hidden="true">
            🌿
          </span>
          <div>
            <h1 className="notebook-sidebar__title">Field Notebook</h1>
            <p className="notebook-sidebar__subtitle">Botanical Register</p>
          </div>
        </div>
        <SidebarNav />
        <footer className="notebook-sidebar__footer">
          <p className="handwritten">Ad natura fidelis</p>
        </footer>
      </aside>

      <main className="notebook-main">
        <Outlet />
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <SidebarNav mobile />
      </nav>
    </div>
  );
}