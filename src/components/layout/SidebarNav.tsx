import { NavLink } from 'react-router-dom';
import './SidebarNav.css';

const navItems = [
  { to: '/', label: 'Observations', icon: '📋', end: true },
  { to: '/plants', label: 'Herbarium', icon: '🌸' },
  { to: '/maps', label: 'Garden Maps', icon: '🗺️' },
  { to: '/blooms', label: 'Bloom Tracker', icon: '🌺' },
  { to: '/watering', label: 'Watering', icon: '💧' },
  { to: '/photos', label: 'Photo Timeline', icon: '📷' },
  { to: '/pruning', label: 'Pruning Notes', icon: '✂️' },
];

interface SidebarNavProps {
  mobile?: boolean;
}

export function SidebarNav({ mobile }: SidebarNavProps) {
  return (
    <ul className={`sidebar-nav ${mobile ? 'sidebar-nav--mobile' : ''}`}>
      {navItems.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `sidebar-nav__link ${isActive ? 'sidebar-nav__link--active' : ''}`
            }
          >
            <span className="sidebar-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="sidebar-nav__label">{item.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
