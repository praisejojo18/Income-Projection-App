(function () {
  var TOKEN_KEY = 'prontolog_token';
  var host = location.hostname || 'localhost';
  var API = 'http://' + host + ':5001/api';
  var token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  fetch(API + '/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.success && d.user && d.user.role === 'SUPER_ADMIN') {
        var settings = document.querySelector('a[href="settings.html"]');
        if (settings && !document.querySelector('a[href="admin.html"]')) {
          var link = document.createElement('a');
          link.href = 'admin.html';
          link.className = 'nav-item';
          link.innerHTML = '<i class="fas fa-user-shield"></i> Manage Users';
          settings.parentNode.insertBefore(link, settings);
        }
      }
    })
    .catch(function () {});
})();