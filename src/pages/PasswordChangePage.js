import React, { useState } from 'react';

function PasswordChangePage({ user, onComplete }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 12 || newPassword.length > 128) {
      setError('Choose a password between 12 and 128 characters.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('The password confirmation does not match.');
      return;
    }
    if (typeof window.api?.changePassword !== 'function') {
      setError('Password changes are only available in the desktop app. Start it with npm start.');
      return;
    }

    setSaving(true);
    try {
      const result = await window.api.changePassword({ newPassword });
      if (!result?.success) throw new Error(result?.error || 'Password change failed.');
      onComplete();
    } catch (changeError) {
      console.error('Required password change failed:', changeError);
      setError(changeError.message || 'Password change failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="main-content forced-password-content">
      <section className="password-change-page card" aria-labelledby="password-change-title">
        <p className="eyebrow">Account security</p>
        <h1 id="password-change-title">Change your password</h1>
        <p className="muted">Hi {user.name}. Set a new password before continuing to the inventory system.</p>
        <div className="notice notice-warning">Your account must have a new password before any other application features are available.</div>
        <form className="password-change-form" onSubmit={handleSubmit} autoComplete="off">
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            autoFocus
          />
          <small>Use 12–128 characters. Avoid reusing your temporary password.</small>
          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
          {error && <div className="error" role="alert">{error}</div>}
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Updating password…' : 'Update password and continue'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default PasswordChangePage;
