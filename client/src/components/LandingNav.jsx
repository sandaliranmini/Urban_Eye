import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Eye, Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'About Us', to: '/about' },
  { label: 'Public Notices', to: '/notices' },
  { label: 'Contact', to: '/contact' },
];

const languages = [
  { code: 'en', label: 'EN' },
  { code: 'si', label: 'සිං' },
  { code: 'ta', label: 'தமிழ்' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState('en');

  const LanguageToggle = () => (
    <div className="flex items-center rounded-full border border-gray-200 bg-[#F5F7FA] p-1">
      {languages.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            lang === l.code
              ? 'bg-[#23845B] text-white'
              : 'text-[#17324D] hover:bg-gray-200'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-[88px] max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-0">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#23845B]">
            <Eye className="h-6 w-6 text-white" />
          </span>
          <span className="text-2xl font-bold text-[#17324D]">Urban Eye</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-10 md:flex">
          {navLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `relative py-8 text-[15px] font-semibold transition hover:text-[#23845B] ${
                  isActive
                    ? "text-[#17324D] after:absolute after:bottom-0 after:left-0 after:h-[3px] after:w-full after:rounded-full after:bg-[#23845B] after:content-['']"
                    : 'text-[#17324D]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Desktop right side */}
        <div className="hidden items-center gap-4 md:flex">
          <LanguageToggle />
          <div className="flex items-center rounded-lg bg-[#17324D] text-sm font-semibold text-white">
            <Link
              to="/login"
              className="rounded-l-lg py-3 pl-5 pr-1.5 transition hover:opacity-90"
            >
              Login
            </Link>
            <span className="opacity-60">/</span>
            <Link
              to="/register"
              className="rounded-r-lg py-3 pl-1.5 pr-5 transition hover:opacity-90"
            >
              Register
            </Link>
          </div>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-[#17324D] hover:bg-gray-100 md:hidden"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-gray-200 bg-white px-4 pb-6 pt-4 md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-3 text-base font-semibold hover:bg-gray-50 ${
                    isActive ? 'bg-[#23845B]/10 text-[#23845B]' : 'text-[#17324D]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <LanguageToggle />
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-[#17324D] py-3 text-center text-sm font-semibold text-white hover:opacity-90"
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-[#23845B] py-3 text-center text-sm font-semibold text-white hover:opacity-90"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}