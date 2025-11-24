import { useState } from 'react';

const initialForm = {
  number: '',
  name: ''
};

export default function App() {
  const [employee, setEmployee] = useState(initialForm);
  const [submitted, setSubmitted] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setEmployee((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(employee);
  };

  const handleReset = () => {
    setEmployee(initialForm);
    setSubmitted(null);
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
            <span className="field__label">Employee Numbers</span>
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
            <button type="submit" className="button">
              Save
            </button>
            <button type="button" className="button button--ghost" onClick={handleReset}>
              Clear
            </button>
          </div>
        </form>

        <section className="summary" aria-live="polite">
          <h2>Saved summary</h2>
          {submitted ? (
            <dl>
              <div className="summary__row">
                <dt>Employee Number</dt>
                <dd>{submitted.number}</dd>
              </div>
              <div className="summary__row">
                <dt>Employee Numbers</dt>
                <dd>{submitted.name}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Submit the form to see the saved employee details.</p>
          )}
        </section>
      </main>
    </div>
  );
}
