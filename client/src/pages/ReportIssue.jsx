import { useState } from 'react';
import { Link } from 'react-router-dom';
import WardSelect from '../components/WardSelect';
import PhotoUpload from '../components/PhotoUpload';
import { CATEGORIES, STEPS, LIMITS } from '../constants/issueConstants';
import { validateStep } from '../utils/issueValidation';
import { useObjectUrl } from '../utils/useObjectUrl';
import { createIssue, buildIssueFormData } from '../services/issueService';

const initialForm = {
  title: '', description: '', category: '', is_emergency: false,
  ward_id: '', ward_name: '', photo: null,
};

export default function ReportIssue() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);   // later: default ward_id from the logged-in citizen
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [created, setCreated] = useState(null);
  const photoUrl = useObjectUrl(form.photo);

  const setField = (name, value) => {
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: undefined }));
  };

  const next = () => {
    const e = validateStep(step, form);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => s + 1);
  };
  const back = () => { setErrors({}); setStep((s) => s - 1); };

  const handleSubmit = async () => {
    setSubmitting(true);
    setServerError('');
    try {
        if (import.meta.env.VITE_USE_MOCK === 'true') {
        await new Promise((r) => setTimeout(r, 800));
        setCreated({ issue_id: 999, is_emergency: form.is_emergency });
        return;
        }
        const res = await createIssue(buildIssueFormData(form));
        setCreated(res.data);
    } catch (err) {
        console.error(err);
        setServerError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Something went wrong. Please try again.'
        );
    } finally {
        setSubmitting(false);
    }
    };

  if (created) {
    return (
      <main className="mx-auto max-w-xl p-4 text-center">
        <h1 className="text-2xl font-bold text-green-700 mb-2">Report submitted</h1>
        <p className="mb-6 text-gray-700">
          {created.is_emergency
            ? 'Officers have been alerted about this emergency.'
            : 'Thank you. Your report is now open for the community to vote on.'}
        </p>
        <Link to={`/issue/${created.issue_id}`} className="inline-block min-h-11 rounded bg-blue-600 px-5 py-2 text-white">
          View your report
        </Link>
        <button type="button" onClick={() => { setCreated(null); setForm(initialForm); setStep(0); }}
          className="ml-3 min-h-11 rounded border px-5 py-2">
          Report another
        </button>
      </main>
    );
  }

  const reviewRows = [
    ['Title', form.title, 0],
    ['Description', form.description, 0],
    ['Category', form.category, 1],
    ['Emergency', form.is_emergency ? 'Yes' : 'No', 1],
    ['Ward', form.ward_name || `Ward #${form.ward_id}`, 2],
  ];

  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="text-2xl font-bold mb-1">Report an issue</h1>
      <p className="text-sm text-gray-600 mb-3">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
      <div className="mb-6 h-2 w-full rounded bg-gray-200" role="progressbar"
           aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
        <div className="h-2 rounded bg-blue-600 transition-all"
             style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">Title</label>
            <input id="title" value={form.title} maxLength={LIMITS.TITLE_MAX}
              aria-invalid={!!errors.title}
              onChange={(e) => setField('title', e.target.value)}
              className="w-full min-h-11 rounded border border-gray-300 p-2" placeholder="e.g. Large pothole on Main Road" />
            <div className="flex justify-between text-xs text-gray-500">
              <span role="alert" className="text-red-700">{errors.title}</span>
              <span>{form.title.length}/{LIMITS.TITLE_MAX}</span>
            </div>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
            <textarea id="description" rows={5} value={form.description} maxLength={LIMITS.DESC_MAX}
              aria-invalid={!!errors.description}
              onChange={(e) => setField('description', e.target.value)}
              className="w-full rounded border border-gray-300 p-2"
              placeholder="What is the problem, where exactly is it, and how long has it been there?" />
            <div className="flex justify-between text-xs text-gray-500">
              <span role="alert" className="text-red-700">{errors.description}</span>
              <span>{form.description.length}/{LIMITS.DESC_MAX}</span>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Category">
            {CATEGORIES.map((c) => (
              <button key={c.value} type="button" role="radio" aria-checked={form.category === c.value}
                onClick={() => setField('category', c.value)}
                className={`rounded border p-3 text-left min-h-11 ${
                  form.category === c.value ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
                <span className="block font-medium">{c.value}</span>
                <span className="block text-xs text-gray-600">{c.hint}</span>
              </button>
            ))}
          </div>
          {errors.category && <p role="alert" className="mt-1 text-sm text-red-700">{errors.category}</p>}

          {/* Emergency toggle: Semini may restyle this and add the alert behaviour */}
          <label className="mt-5 flex items-start gap-3 rounded border border-red-300 bg-red-50 p-3">
            <input type="checkbox" checked={form.is_emergency}
              onChange={(e) => setField('is_emergency', e.target.checked)} className="mt-1 h-5 w-5" />
            <span className="text-sm">
              <strong>This is a life-threatening emergency</strong><br />
              Use only for serious hazards (collapsed structures, exposed live wires, major water main bursts).
              False emergency reports lower your credibility score.
            </span>
          </label>
        </div>
      )}

      {step === 2 && (
        <WardSelect value={form.ward_id} error={errors.ward_id}
          onChange={(id, name) => {
            setForm((p) => ({ ...p, ward_id: id, ward_name: name }));
            setErrors((p) => ({ ...p, ward_id: undefined }));
          }} />
      )}

      {step === 3 && (
        <PhotoUpload file={form.photo} error={errors.photo} onChange={(f) => setField('photo', f)} />
      )}

      {step === 4 && (
        <div>
          <dl className="divide-y rounded border">
            {reviewRows.map(([label, value, goTo]) => (
              <div key={label} className="flex items-start justify-between gap-3 p-3">
                <div>
                  <dt className="text-xs text-gray-500">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
                <button type="button" onClick={() => setStep(goTo)} className="text-sm text-blue-700 underline">Edit</button>
              </div>
            ))}
          </dl>
          {photoUrl && <img src={photoUrl} alt="Your photo" className="mt-4 w-full max-h-64 rounded object-cover" />}
          {/* Card 7 (duplicate detection) will add its "similar issues" warning here */}
        </div>
      )}

      {serverError && (
        <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{serverError}</p>
      )}

      <div className="mt-6 flex justify-between gap-3">
        <button type="button" onClick={back} disabled={step === 0 || submitting}
          className="min-h-11 rounded border px-5 py-2 disabled:opacity-40">Back</button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className="min-h-11 rounded bg-blue-600 px-5 py-2 text-white">Next</button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="min-h-11 rounded bg-green-600 px-5 py-2 text-white disabled:opacity-60">
            {submitting ? 'Submitting…' : 'Submit report'}
          </button>
        )}
      </div>
    </main>
  );
}