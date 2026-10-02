/* ============================================================
   AUTH GUARD — Redirect to login if not authenticated
   ============================================================ */
(function() {
    'use strict';
    
    const token = localStorage.getItem('prontolog_token');
    const userId = localStorage.getItem('prontolog_user_id');
    
    // If no token or no user ID, redirect to login immediately
    if (!token || !userId) {
        // Prevent infinite redirect loops if we're already on login.html
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
            return;
        }
    }
    
    // Optional: Check if token is expired (JWT decode)
    try {
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < now) {
                // Token expired, clear and redirect
                localStorage.removeItem('prontolog_token');
                localStorage.removeItem('prontolog_user_id');
                if (!window.location.pathname.includes('login.html')) {
                    window.location.href = 'login.html';
                    return;
                }
            }
        }
    } catch (e) {
        // Token decode failed, treat as invalid
        localStorage.removeItem('prontolog_token');
        localStorage.removeItem('prontolog_user_id');
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
            return;
        }
    }
})();



(function () {
  var TOKEN_KEY = 'prontolog_token';
  var host = location.hostname || 'localhost';
  var API = 'http://' + host + ':5001/api';

  function extractRole(d) {
    if (!d) return '';
    if (d.role) return d.role;
    if (d.user && d.user.role) return d.user.role;
    if (d.data && d.data.role) return d.data.role;
    if (d.payload && d.payload.role) return d.payload.role;
    return '';
  }

  function insertLink() {
    if (document.querySelector('a[href="admin.html"]')) return;
    var settings = document.querySelector('a[href="settings.html"]');
    if (!settings || !settings.parentNode) return;
    var link = document.createElement('a');
    link.href = 'admin.html';
    link.className = 'nav-item';
    link.innerHTML = '<i class="fas fa-user-shield"></i> Manage Users';
    settings.parentNode.insertBefore(link, settings);
  }

  function tryAdd() {
    var token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    if (document.querySelector('a[href="admin.html"]')) return;
    var settings = document.querySelector('a[href="settings.html"]');
    if (!settings) { setTimeout(tryAdd, 300); return; }

    fetch(API + '/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (extractRole(d) === 'SUPER_ADMIN') insertLink();
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryAdd);
  } else {
    tryAdd();
  }
  setTimeout(tryAdd, 800);
  setTimeout(tryAdd, 2000);
})();