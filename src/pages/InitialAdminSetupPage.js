import React, { useState } from 'react';

function InitialAdminSetupPage({ onCreateAdmin, error, loading }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [validationError, setValidationError] = useState('');

  const submit = event => {
    event.preventDefault();
    setValidationError('');
    if (!name.trim()) return setValidationError('Enter an administrator username.');
    if (password.length < 12 || password.length > 128) return setValidationError('Choose a password between 12 and 128 characters.');
    if (password !== confirmation) return setValidationError('The password confirmation does not match.');
    onCreateAdmin({ name: name.trim(), password });
  };

  return (
    <section className="password-change-page card" aria-labelledby="setup-admin-title">
      <p className="eyebrow">First-time setup</p>
      <h1 id="setup-admin-title">Create the administrator account</h1>
      <p className="muted">Set up the first administrator to secure and manage this inventory system.</p>
      <form className="password-change-form" onSubmit={submit} autoComplete="off">
        <label htmlFor="setup-admin-name">Administrator username</label>
        <input id="setup-admin-name" type="text" value={name} onChange={event => setName(event.target.value)} maxLength={80} autoComplete="username" required autoFocus />
        <label htmlFor="setup-admin-password">Password</label>
        <input id="setup-admin-password" type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required />
        <small>Use 12–128 characters. Store the new credentials securely.</small>
        <label htmlFor="setup-admin-confirmation">Confirm password</label>
        <input id="setup-admin-confirmation" type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required />
        {(validationError || error) && <div className="error" role="alert">{validationError || error}</div>}
        <button type="submit" className="primary-button" disabled={loading}>{loading ? 'Creating administrator…' : 'Create administrator'}</button>
      </form>
    </section>
  );
}

export default InitialAdminSetupPage;
