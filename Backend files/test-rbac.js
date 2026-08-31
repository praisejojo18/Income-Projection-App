const API = 'http://localhost:5001/api';
(async () => {
  const login = async (email) => {
    const r = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    return r.json();
  };

  const sup = await login('super@prontolog.com');
  const usr = await login('user@prontolog.com');

  const asSuper = await fetch(API + '/users', { headers: { Authorization: 'Bearer ' + sup.token } });
  const asUser  = await fetch(API + '/users', { headers: { Authorization: 'Bearer ' + usr.token } });

  console.log('SUPER ADMIN lists users →', asSuper.status, '(expect 200 ✅)');
  console.log('REGULAR USER lists users →', asUser.status, '(expect 403 🚫)');
})();