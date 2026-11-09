import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Map,
  Camera,
  UserCheck,
  CheckCircle2,
  ThumbsUp,
  AlertTriangle,
  Lightbulb,
  Bell,
  MapPin,
  Calendar,
  Shield,
  Plus,
  Flame,
  Mail,
  Phone,
  ChevronDown,
  Eye,
} from 'lucide-react';
import Navbar from '../components/LandingNav';

const stats = [
  { value: '12.4K', label: 'Issues reported' },
  { value: '86%', label: 'Fixed on time' },
  { value: '27', label: 'Councils onboarded' },
];

const steps = [
  { no: '01', icon: Camera, title: 'Report', text: 'Snap a photo of the issue and pin its exact location.' },
  { no: '02', icon: UserCheck, title: 'Track', text: 'Council assigns an officer and you follow every update.' },
  { no: '03', icon: CheckCircle2, title: 'Verify', text: 'Once it is fixed, confirm the repair with a review.' },
  { no: '04', icon: ThumbsUp, title: 'Community', text: 'Upvote problems near you to push them up the queue.' },
];

const notices = [
  {
    tag: 'EMERGENCY',
    tagClass: 'bg-[#D92D20] text-white',
    headerClass: 'bg-[#FDECEA]',
    icon: AlertTriangle,
    iconClass: 'text-[#D92D20]',
    date: 'Today, 7:40 AM',
    title: 'Water main burst on Galle Rd',
    body: 'Crews are isolating the leak. Use alternate routes until further notice.',
    meta1: 'Colombo 03, Ward 8',
    meta2: 'Issued by Colombo Municipal Council',
  },
  {
    tag: 'UPDATE',
    tagClass: 'bg-[#23845B] text-white',
    headerClass: 'bg-[#E3F1EA]',
    icon: Lightbulb,
    iconClass: 'text-[#23845B]',
    date: 'Posted 05 Nov 2026',
    title: 'Streetlight repairs in Ward 12',
    body: 'Over 40 streetlights on Park Avenue will be replaced this week for night safety.',
    meta1: 'Ward 12, Dehiwala',
    meta2: 'Status: Work scheduled',
  },
  {
    tag: 'NOTICE',
    tagClass: 'bg-[#17324D] text-white',
    headerClass: 'bg-[#E6ECF3]',
    icon: Bell,
    iconClass: 'text-[#17324D]',
    date: 'Hearing on 22 Nov',
    title: 'Public hearing: waste schedule',
    body: 'Residents can review proposed changes and submit feedback before 20 November.',
    meta1: 'Municipal Council Hall, Kandy',
    meta2: 'Open for comments until 20 Nov',
  },
];

const hotlines = [
  { icon: Shield, title: 'Police Emergency', text: 'Crime, accidents, and immediate danger', number: '119' },
  { icon: Plus, title: 'Ambulance', text: 'Medical emergencies and injuries', number: '1990' },
  { icon: Flame, title: 'Disaster Management', text: 'Floods, landslides, and fires', number: '117' },
];

const councils = [
  'Colombo Municipal Council',
  'Kandy Municipal Council',
  'Galle Municipal Council',
  'Dehiwala-Mount Lavinia Municipal Council',
  'Jaffna Municipal Council',
];

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-[#F5F7FA] px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#23845B] focus:ring-2 focus:ring-[#23845B]/20';

export default function Landing() {
  const [form, setForm] = useState({ name: '', email: '', council: '', message: '' });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: connect to your API
    console.log('Contact form submitted', form);
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] font-sans text-gray-900">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-0 lg:py-20">
          <div>
            <span className="inline-block rounded-full bg-[#E3F1EA] px-9 py-2 text-xs font-semibold text-[#23845B]">
              Trusted by Sri Lankan municipalities
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-[#17324D] sm:text-5xl lg:text-[56px]">
              Empowering Citizens.
              <span className="block text-[#23845B]">Fixing Communities.</span>
            </h1>
            <p className="mt-8 max-w-[540px] text-lg leading-8 text-gray-600">
              Report potholes, waste, and broken streetlights directly to your municipal council.
              Track progress, verify fixes, and build a safer neighbourhood together.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/report"
                className="inline-flex items-center gap-8 rounded-lg bg-[#23845B] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#1a5c40]"
              >
                Report an Issue <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-8 rounded-lg bg-[#17324D] px-6 py-4 text-sm font-semibold text-white transition hover:opacity-90"
              >
                View Live Map <Map className="h-5 w-5" />
              </Link>
            </div>

            <dl className="mt-10 flex max-w-[520px] flex-wrap gap-x-12 gap-y-4 border-t border-gray-200 pt-5">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="text-2xl font-bold text-[#17324D]">{s.value}</dt>
                  <dd className="text-sm text-gray-600">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Map illustration */}
          <div className="relative mx-auto aspect-[27/22] w-full max-w-[540px] lg:max-w-none">
            <div className="absolute -right-20 -top-24 hidden h-72 w-72 rounded-full bg-[#E3EAF2] lg:block" />
            <div className="relative h-full w-full overflow-hidden rounded-[32px] bg-[#17324D] shadow-xl">
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 540 440"
                preserveAspectRatio="none"
                fill="none"
              >
                <defs>
                  <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 50" stroke="#2A4A6B" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="540" height="440" fill="url(#grid)" opacity="0.6" />
                <path d="M0 160 C120 130 200 220 300 190 S 480 100 540 120" stroke="#35618F" strokeWidth="14" strokeLinecap="round" />
                <path d="M410 0 C380 90 340 160 250 300 S 120 420 100 440" stroke="#35618F" strokeWidth="12" strokeLinecap="round" />
                <path d="M0 330 L540 290" stroke="#35618F" strokeWidth="8" strokeLinecap="round" />
                <rect x="320" y="290" width="120" height="76" rx="14" fill="#1C5C45" />
              </svg>

              <span className="absolute left-7 top-6 rounded-full bg-[#23845B] px-3 py-1 text-[11px] font-bold tracking-wide text-white">
                LIVE
              </span>

              <MapPin className="absolute left-[23%] top-[16%] h-10 w-10 fill-[#D92D20] text-[#D92D20]" />
              <MapPin className="absolute left-[43%] top-[48%] h-10 w-10 fill-[#23845B] text-[#23845B]" />
              <MapPin className="absolute left-[82%] top-[38%] h-10 w-10 fill-[#23845B] text-[#23845B]" />

              <div className="absolute right-5 top-5 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E3F1EA]">
                  <CheckCircle2 className="h-5 w-5 text-[#23845B]" />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#17324D]">Issue resolved</p>
                  <p className="text-xs text-gray-500">Ward 12 · 2 days ago</p>
                </div>
              </div>

              <div className="absolute bottom-6 left-5 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FDECEA]">
                  <AlertTriangle className="h-5 w-5 text-[#D92D20]" />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#17324D]">Pothole reported</p>
                  <p className="text-xs text-gray-500">Galle Road, Colombo 03</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 lg:px-0">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-[#23845B]">How it works</p>
          <h2 className="mt-2 text-3xl font-bold text-[#17324D] sm:text-4xl">
            From a single photo to a fixed street
          </h2>
          <p className="mt-3 text-gray-600">
            Four simple steps connect residents and councils in one transparent workflow.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ no, icon: Icon, title, text }) => (
            <article
              key={title}
              className="rounded-2xl border border-gray-200 bg-white p-8 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E3F1EA]">
                  <Icon className="h-6 w-6 text-[#23845B]" />
                </span>
                <span className="text-sm font-semibold text-gray-400">{no}</span>
              </div>
              <h3 className="mt-5 text-xl font-bold text-[#17324D]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* PUBLIC NOTICES */}
      <section id="notices" className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 lg:px-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#23845B]">Public notices</p>
            <h2 className="mt-1 text-3xl font-bold text-[#17324D] sm:text-4xl">
              Latest from your councils
            </h2>
          </div>
          <Link
            to="/notices"
            className="inline-flex items-center gap-3 text-sm font-semibold text-[#23845B] hover:opacity-80"
          >
            View all notices <ArrowRight className="h-5 w-5" />
          </Link>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {notices.map((n) => {
            const Icon = n.icon;
            return (
              <article
                key={n.title}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-lg"
              >
                <div className={`relative flex h-[150px] items-center justify-center ${n.headerClass}`}>
                  <span
                    className={`absolute left-5 top-5 rounded-full px-4 py-1.5 text-[11px] font-bold tracking-wide ${n.tagClass}`}
                  >
                    {n.tag}
                  </span>
                  <span className="absolute right-4 top-4 text-xs text-gray-600">{n.date}</span>
                  <Icon className={`h-10 w-10 ${n.iconClass}`} />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-[#17324D]">{n.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{n.body}</p>
                  <div className="mt-4 space-y-3 border-t border-gray-100 pt-4 text-sm text-gray-600">
                    <p className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-gray-500" /> {n.meta1}
                    </p>
                    <p className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-gray-500" /> {n.meta2}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* EMERGENCY & CONTACT */}
      <section id="contact" className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 lg:px-0">
        <p className="text-xs font-bold uppercase tracking-wide text-[#23845B]">Emergency &amp; contact</p>
        <h2 className="mt-1 text-3xl font-bold text-[#17324D] sm:text-4xl">
          Need help now? Reach your council.
        </h2>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          {/* Hotlines */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold text-[#17324D]">Emergency Hotlines</h3>
                <p className="mt-2 text-sm text-gray-600">Call immediately for life-threatening situations.</p>
              </div>
              <span className="rounded-full bg-[#FDECEA] px-4 py-1.5 text-xs font-bold text-[#D92D20]">
                24 / 7
              </span>
            </div>

            <ul className="mt-6 space-y-3">
              {hotlines.map(({ icon: Icon, title, text, number }) => (
                <li key={title}>
                  <a
                    href={`tel:${number}`}
                    className="flex items-center gap-4 rounded-xl bg-[#FDECEA] px-5 py-5 transition hover:opacity-90"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D92D20]">
                      <Icon className="h-5 w-5 text-white" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#17324D]">{title}</p>
                      <p className="text-xs text-gray-600">{text}</p>
                    </div>
                    <span className="text-3xl font-extrabold text-[#D92D20]">{number}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact form */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <h3 className="text-2xl font-bold text-[#17324D]">Contact Municipal Council</h3>
            <p className="mt-2 text-sm text-gray-600">
              Send a question, complaint, or feedback to your local council.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-sm font-bold text-[#17324D]">
                    Full name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-bold text-[#17324D]">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="council" className="mb-1.5 block text-sm font-bold text-[#17324D]">
                  Municipal council
                </label>
                <div className="relative">
                  <select
                    id="council"
                    name="council"
                    required
                    value={form.council}
                    onChange={handleChange}
                    className={`${inputClass} appearance-none pr-10 ${form.council ? '' : 'text-gray-400'}`}
                  >
                    <option value="" disabled>
                      Select your municipal council
                    </option>
                    {councils.map((c) => (
                      <option key={c} value={c} className="text-gray-900">
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                </div>
              </div>

              <div>
                <label htmlFor="message" className="mb-1.5 block text-sm font-bold text-[#17324D]">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={3}
                  required
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Describe your question or concern"
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  className="rounded-lg bg-[#23845B] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#1a5c40]"
                >
                  Send Message
                </button>
                <span className="text-xs text-gray-500">We reply within 3 working days.</span>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-12 bg-[#17324D] text-white">
        <div className="mx-auto max-w-[1200px] px-4 pt-10 sm:px-6 lg:px-0">
          <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <Link to="/" className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#23845B]">
                  <Eye className="h-6 w-6 text-white" />
                </span>
                <span className="text-2xl font-bold">Urban Eye</span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-6 text-gray-300">
                Civic issue triage and verification for Sri Lankan municipalities.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold">Explore</h4>
              <ul className="mt-4 space-y-3 text-sm text-gray-300">
                <li><Link to="/" className="transition hover:text-white">Home</Link></li>
                <li><Link to="/about" className="transition hover:text-white">About Us</Link></li>
                <li><Link to="/notices" className="transition hover:text-white">Public Notices</Link></li>
                <li><Link to="/contact" className="transition hover:text-white">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold">Contact</h4>
              <ul className="mt-4 space-y-3 text-sm text-gray-300">
                <li className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-[#23845B]" />
                  <a href="mailto:support@urbaneye.lk" className="transition hover:text-white">support@urbaneye.lk</a>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-[#23845B]" />
                  <a href="tel:+94112345678" className="transition hover:text-white">+94 11 234 5678</a>
                </li>
                <li className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-[#23845B]" />
                  Colombo, Sri Lanka
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/10 py-6 text-xs text-gray-300 sm:flex-row sm:items-center">
            <p>© 2026 Urban Eye. All rights reserved.</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link to="/privacy" className="transition hover:text-white">Privacy Policy</Link>
              <Link to="/pdpa" className="transition hover:text-white">PDPA Compliance</Link>
              <Link to="/terms" className="transition hover:text-white">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}