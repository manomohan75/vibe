import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const initialForm = {
  number: '',
  name: ''
};

export default function App() {
  const [employee, setEmployee] = useState(initialForm);
  const [submitted, setSubmitted] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setStatus('idle');
    setError(null);
    setEmployee((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('saving');
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employee)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to save employee right now.');
      }

      setSubmitted(data.employee);
      setStatus('success');
    } catch (err) {
      setSubmitted(null);
      setStatus('error');
      setError(err?.message || 'Unexpected error occurred.');
    }
  };

  const handleDelete = async (event) => {
    event.preventDefault();

    if (!employee.number) {
      setError('Employee number is required to delete.');
      return;
    }

    setStatus('deleting');
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/employees/${encodeURIComponent(employee.number)}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to delete employee right now.');
      }

      setEmployee(initialForm);
      setSubmitted(null);
      setStatus('deleted');
    } catch (err) {
      setStatus('error');
      setError(err?.message || 'Unexpected error occurred.');
    }
  };

  const handleReset = () => {
    setEmployee(initialForm);
    setSubmitted(null);
    setStatus('idle');
    setError(null);
  };

  return (
    <div className="page">
      <main className="card">
        <header className="card__header">
          <h1>Employee Details</h1>
          <p className="muted">Enter an employee number and name to preview the saved record.</p>
        </header>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Emp #</span>
            <input
              type="text"
              name="number"
              value={employee.number}
              onChange={handleChange}
              placeholder="e.g. EMP-001"
              required
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span className="field__label">Emp Name</span>
            <input
              type="text"
              name="name"
              value={employee.name}
              onChange={handleChange}
              placeholder="e.g. Ada Lovelace"
              required
              autoComplete="off"
            />
          </label>

          <div className="actions">
            <button type="submit" className="button" disabled={status === 'saving' || status === 'deleting'}>
              {status === 'saving' ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={handleDelete}
              disabled={status === 'saving' || status === 'deleting' || !employee.number}
            >
              {status === 'deleting' ? 'Deleting...' : 'Delete'}
            </button>
            <button type="button" className="button button--ghost" onClick={handleReset}>
              Clear
            </button>
          </div>
        </form>

        <section className="summary" aria-live="polite">
          <h2>Saved summary</h2>
          {error && <p className="muted">Error: {error}</p>}
          {submitted ? (
            <dl>
              <div className="summary__row">
                <dt>Database ID</dt>
                <dd>{submitted.id}</dd>
              </div>
              <div className="summary__row">
                <dt>Emp #</dt>
                <dd>{submitted.number}</dd>
              </div>
              <div className="summary__row">
                <dt>Emp Name</dt>
                <dd>{submitted.name}</dd>
              </div>
              <div className="summary__row">
                <dt>Created</dt>
                <dd>{new Date(submitted.createdAt).toLocaleString()}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">
              {status === 'saving'
                ? 'Saving employee to the database...'
                : status === 'deleting'
                  ? 'Deleting employee...'
                  : status === 'deleted'
                    ? 'Employee deleted.'
                    : 'Submit the form to save the employee details to Postgres.'}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
