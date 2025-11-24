import { useEffect, useState } from 'react';

const clientOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const isLocalDevHost = /localhost:(5173|4173)|127\.0\.0\.1:(5173|4173)/i.test(clientOrigin);
const API_BASE =
  (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.replace(/\/$/, '')) ||
  (isLocalDevHost ? 'http://localhost:4000' : clientOrigin || 'http://localhost:4000');

const initialForm = {
  number: '',
  name: ''
};

const safeParseJson = async (response) => {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    const text = await response.text();
    const preview = text?.trim().slice(0, 200);
    return {
      error:
        preview ||
        `Received a non-JSON response (status ${response.status || 'unknown'}). Please verify the API server is running.`
    };
  } catch (_err) {
    return { error: 'Failed to parse server response.' };
  }
};

export default function App() {
  const [employee, setEmployee] = useState(initialForm);
  const [employees, setEmployees] = useState([]);
  const [submitted, setSubmitted] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [listStatus, setListStatus] = useState('loading');
  const [listError, setListError] = useState(null);
  const [editingNumber, setEditingNumber] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setStatus('idle');
    setError(null);
    setEmployee((current) => ({ ...current, [name]: value }));
  };

  const loadEmployees = async () => {
    setListStatus('loading');
    setListError(null);

    try {
      const response = await fetch(`${API_BASE}/api/employees`);
      const data = await safeParseJson(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load employees right now.');
      }

      setEmployees(data.employees || []);
      setListStatus('success');
    } catch (err) {
      setListStatus('error');
      setListError(err?.message || 'Unexpected error loading employees.');
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const isEditing = Boolean(editingNumber);
    setStatus(isEditing ? 'updating' : 'saving');
    setError(null);

    const payload = isEditing
      ? {
          name: employee.name,
          newNumber: employee.number
        }
      : employee;

    const endpoint = isEditing
      ? `${API_BASE}/api/employees/${encodeURIComponent(editingNumber)}`
      : `${API_BASE}/api/employees`;

    try {
      const response = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await safeParseJson(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to save employee right now.');
      }

      setSubmitted(data.employee);
      setEmployee({ number: data.employee.number, name: data.employee.name });
      setEditingNumber(isEditing ? data.employee.number : null);
      setStatus('success');
      loadEmployees();
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

      const data = await safeParseJson(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to delete employee right now.');
      }

      setEmployee(initialForm);
      setSubmitted(null);
      setEditingNumber(null);
      setStatus('deleted');
      loadEmployees();
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
    setEditingNumber(null);
  };

  const handleEditSelect = (emp) => {
    setEmployee({ number: emp.number, name: emp.name });
    setSubmitted(emp);
    setEditingNumber(emp.number);
    setStatus('idle');
    setError(null);
  };

  return (
    <div className="page">
      <main className="card">
        <header className="card__header">
          <h1>Employee Details</h1>
          <p className="muted">
            Enter an employee number and name to preview the saved record. Select an employee below to edit their
            details.
          </p>
        </header>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Employee Number</span>
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
            <button
              type="submit"
              className="button"
              disabled={status === 'saving' || status === 'deleting' || status === 'updating'}
            >
              {status === 'saving' ? 'Saving...' : status === 'updating' ? 'Updating...' : editingNumber ? 'Update' : 'Save'}
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
                <dt>Employee Number</dt>
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
              {submitted.updatedAt && (
                <div className="summary__row">
                  <dt>Updated</dt>
                  <dd>{new Date(submitted.updatedAt).toLocaleString()}</dd>
                </div>
              )}
              {editingNumber && (
                <div className="summary__row">
                  <dt>Editing</dt>
                  <dd>{editingNumber}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="muted">
              {status === 'saving'
                ? 'Saving employee to the database...'
                : status === 'updating'
                  ? 'Updating employee...'
                  : status === 'deleting'
                  ? 'Deleting employee...'
                  : status === 'deleted'
                    ? 'Employee deleted.'
                    : 'Submit the form to save the employee details to Postgres.'}
            </p>
          )}
        </section>

        <section className="list" aria-live="polite">
          <div className="list__header">
            <div>
              <h2>Employees</h2>
              <p className="muted">Select a row to edit it.</p>
            </div>
            <button type="button" className="button button--ghost" onClick={loadEmployees} disabled={listStatus === 'loading'}>
              {listStatus === 'loading' ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {listError && <p className="muted">Error: {listError}</p>}

          {listStatus === 'loading' && <p className="muted">Loading employees...</p>}

          {listStatus === 'success' && employees.length === 0 && <p className="muted">No employees saved yet.</p>}

          {listStatus === 'success' && employees.length > 0 && (
            <div className="table">
              <div className="table__head">
                <span>Employee Number</span>
                <span>Name</span>
                <span>Created</span>
                <span>Updated</span>
                <span>Action</span>
              </div>
              <div className="table__body">
                {employees.map((emp) => (
                  <button key={emp.id} className="table__row" type="button" onClick={() => handleEditSelect(emp)}>
                    <span>{emp.number}</span>
                    <span>{emp.name}</span>
                    <span>{new Date(emp.createdAt).toLocaleDateString()}</span>
                    <span>{emp.updatedAt ? new Date(emp.updatedAt).toLocaleDateString() : '—'}</span>
                    <span className="table__action">Edit</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
