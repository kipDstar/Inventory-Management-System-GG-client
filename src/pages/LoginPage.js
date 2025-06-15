// src/pages/LoginPage.js
// Login page for admin and sales users

import React, { useState } from 'react';

function LoginPage({ onLogin, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="login-page card">
      <h2>Login</h2>
      <form onSubmit={handleSubmit} autoComplete="off">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button type="submit">Login</button>
      </form>
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export default LoginPage;
