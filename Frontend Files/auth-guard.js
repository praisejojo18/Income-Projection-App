/* ============================================================
   PRONTOX AUTH GUARD
   Blocks unauthenticated access to EVERY page.
   Loaded in <head> so it redirects before the page even paints.
   ============================================================ */
(function () {
    'use strict';

    var path = window.location.pathname || '';
    var isLogin = path.indexOf('login.html') !== -1;

    function bounce() {
        window.location.replace('login.html');
    }

    var token = localStorage.getItem('prontolog_token');

    // 1) No token at all → straight to login
    if (!token) {
        if (!isLogin) bounce();
        return;
    }

    // 2) Token exists → verify it's not expired / corrupted
    try {
        var base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        var payload = JSON.parse(atob(base64));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            localStorage.removeItem('prontolog_token');
            localStorage.removeItem('prontolog_user_id');
            if (!isLogin) bounce();
        }
    } catch (e) {
        // Corrupted token → clear and bounce
        localStorage.removeItem('prontolog_token');
        localStorage.removeItem('prontolog_user_id');
        if (!isLogin) bounce();
    }
})();