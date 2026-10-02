/* ============================================================
   PRONTOLOG — UNIVERSAL UI ENHANCEMENTS
   • Back-to-top button
   • Invisible scrollbar styling
   • 🆕 UNIVERSAL LOGOUT MODAL (auto-injected, works on every page)
   ============================================================ */
(function () {
    'use strict';

    /* ---------- Inject modal CSS ---------- */
    const style = document.createElement('style');
    style.textContent = `
        .px-logout-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.5);
            z-index: 99999; display: none; align-items: center; justify-content: center;
            padding: 20px; backdrop-filter: blur(3px);
        }
        .px-logout-overlay.open { display: flex; }
        .px-logout-box {
            background: var(--surface, #FFFFFF);
            border-radius: 14px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.15);
            width: 100%; max-width: 400px;
            animation: pxLogoutPop 0.2s ease;
            overflow: hidden;
        }
        @keyframes pxLogoutPop {
            0% { opacity: 0; transform: scale(0.96) translateY(6px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .px-logout-body { padding: 32px 28px 20px; text-align: center; }
        .px-logout-icon {
            width: 60px; height: 60px; border-radius: 50%;
            background: #FEF3C7; color: #F59E0B;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.6rem; margin: 0 auto 18px;
        }
        [data-theme="dark"] .px-logout-icon { background: #3a2a0a; color: #fbbf24; }
        .px-logout-title {
            font-size: 1.1rem; font-weight: 700; color: var(--text-primary, #1A2332);
            margin: 0 0 8px;
        }
        .px-logout-msg {
            font-size: 0.9rem; color: var(--text-secondary, #475569);
            line-height: 1.6; margin: 0;
        }
        .px-logout-footer {
            display: flex; gap: 10px; padding: 16px 24px 24px;
            justify-content: center;
        }
        .px-logout-btn {
            padding: 10px 22px; border-radius: 10px; font-size: 0.88rem;
            font-weight: 600; cursor: pointer; transition: all 0.15s;
            border: none; font-family: inherit;
        }
        .px-logout-btn.cancel {
            background: var(--surface-2, #F8FAFC);
            color: var(--text-primary, #1A2332);
            border: 1px solid var(--border, #E2E8F0);
        }
        .px-logout-btn.cancel:hover { background: var(--border, #E2E8F0); }
        .px-logout-btn.confirm {
            background: #ef4444; color: #fff;
        }
        .px-logout-btn.confirm:hover { background: #dc2626; }
    `;
    document.head.appendChild(style);

    /* ---------- Inject modal HTML ---------- */
    const modal = document.createElement('div');
    modal.className = 'px-logout-overlay';
    modal.id = 'pxLogoutOverlay';
    modal.innerHTML = `
        <div class="px-logout-box">
            <div class="px-logout-body">
                <div class="px-logout-icon"><i class="fas fa-sign-out-alt"></i></div>
                <h3 class="px-logout-title">Log out of ProntoLog?</h3>
                <p class="px-logout-msg">You'll need to sign in again to access your workspace.</p>
            </div>
            <div class="px-logout-footer">
                <button type="button" class="px-logout-btn cancel" id="pxLogoutCancel">Cancel</button>
                <button type="button" class="px-logout-btn confirm" id="pxLogoutConfirm">
                    <i class="fas fa-sign-out-alt" style="margin-right:6px;"></i>Yes, log me out
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    /* ---------- Modal behavior ---------- */
    function openLogoutModal() {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeLogoutModal() {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
    function doLogout() {
        try { localStorage.clear(); } catch (_) {}
        window.location.href = 'login.html';
    }

    document.getElementById('pxLogoutCancel').addEventListener('click', closeLogoutModal);
    document.getElementById('pxLogoutConfirm').addEventListener('click', doLogout);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeLogoutModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) closeLogoutModal();
    });

    /* ---------- 🎯 Intercept logout button on EVERY page ---------- */
    // Uses CAPTURE phase (true) so we run BEFORE the inline page handlers,
    // then stopImmediatePropagation blocks them. No confirm() ever shows.
    function wireLogout() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (!logoutBtn) return;
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            openLogoutModal();
        }, true);  // ← true = capture phase, runs first
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireLogout);
    } else {
        wireLogout();
    }

    /* ============================================================
       Back-to-top + invisible scrollbar (unchanged)
       ============================================================ */
    /* ... keep whatever back-to-top logic you already had here ... */
    const backToTop = document.createElement('button');
    backToTop.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTop.style.cssText = `
        position:fixed; bottom:24px; right:24px; width:44px; height:44px;
        border-radius:50%; background:var(--accent, #00AFEF); color:#fff;
        border:none; cursor:pointer; z-index:999; display:none;
        align-items:center; justify-content:center; font-size:1rem;
        box-shadow:0 4px 12px rgba(0,0,0,0.15); transition:all 0.2s;
    `;
    backToTop.onmouseenter = () => backToTop.style.transform = 'translateY(-3px)';
    backToTop.onmouseleave = () => backToTop.style.transform = 'translateY(0)';
    backToTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.appendChild(backToTop);

    window.addEventListener('scroll', () => {
        backToTop.style.display = window.scrollY > 300 ? 'flex' : 'none';
    });

    console.log('✅ UI enhancements + universal logout modal ready.');
})();