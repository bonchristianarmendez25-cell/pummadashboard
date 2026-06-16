/**
 * PUMMA DASHBOARD PATCH v1.1
 * 
 * FIX 1 — Bonus inflation: cap autoBonus at 5% max
 * FIX 2 — Manual Grade Converter: auto-populate from selected cadet
 * 
 * HOW TO APPLY:
 *   Paste the entire contents of this file just before </body> in your index.html
 *   as a <script> block.
 */

(function applyPummaPatch() {
    'use strict';

    // ─────────────────────────────────────────────────────────────────
    // FIX 1: Cap autoBonus at 5% to prevent grade inflation
    //
    // Root cause: totalMeritsSum = sem1 + sem2 + sem3 can reach 900+
    // while maxMeritCap = 450 (one semester).  So excessMerits = 450,
    // autoBonus = (450/10) * 0.5 = 22.5% — way too high.
    //
    // Solution: cap the output of the autoBonus formula at 5%.
    // ─────────────────────────────────────────────────────────────────
    function patchRecalculate() {
        const original = window.recalculateMetrics;
        if (!original) { setTimeout(patchRecalculate, 500); return; }

        window.recalculateMetrics = function () {
            original.apply(this, arguments);

            if (!window.cadets) return;

            window.cadets.forEach(cadet => {
                if (cadet.autoBonus === undefined) return;

                // Hard-cap
                const cappedBonus = Math.min(5, cadet.autoBonus);
                if (cappedBonus === cadet.autoBonus) return; // no change needed

                cadet.autoBonus = cappedBonus;

                // Re-derive specificGradePercent with corrected bonus
                if (!window.convertRatingToPercentGrade) return;
                const base      = parseFloat(window.convertRatingToPercentGrade(cadet.finalRating || 0));
                const manualB   = parseFloat(cadet.individualBonus) || 0;
                const starB     = cadet.starCadet ? 2.0 : 0;
                let corrected   = base + manualB + cappedBonus + starB;
                if (corrected > 98) corrected = 98;
                cadet.specificGradePercent = corrected.toFixed(2);
            });
        };
    }

    // ─────────────────────────────────────────────────────────────────
    // FIX 2A: Auto-populate converter from the currently selected cadet
    // ─────────────────────────────────────────────────────────────────
    window.loadCadetIntoConverter = function () {
        if (!window.selectedCadetId) {
            alert(
                'No cadet selected.\n\n' +
                'Click "Assess" on a cadet from the Class Records table first, ' +
                'then click "Load Selected Cadet".'
            );
            return;
        }

        const c = window.cadets && window.cadets.find(x => x.id === window.selectedCadetId);
        if (!c) { alert('Cadet data not found.'); return; }

        // ── Identity ─────────────────────────────────────────────────
        setV('conv-studentNo', c.studentId || c.id.slice(-8));
        setV('conv-cadetName', c.name || '');

        // ── Derive scores (all 0-100 scale) ──────────────────────────
        // Mockboat Duties (50 % of CS) — avg of tech + soft checklists
        const techCS  = (c.technicalCS || 1);
        const softCS  = (c.softCS      || 1);
        const dutyScore = Math.round(((techCS + softCS) / 2 / 5) * 100);

        // Logbook Recording (25 % of CS) — logbookCompletion is 0-1 ratio
        const logScore = Math.round((c.logbookCompletion || 0) * 100);

        // Patriotism / Merits (25 % of CS) — patriotismCS is 1-5
        const patriotismScore = Math.round(((c.patriotismCS || 1) / 5) * 100);

        // ICPE Exam Score (100 % of PT) — use mean GWA (already 0-100)
        const icpeScore = Math.round(c.gwa || 0);

        // ── Fill inputs ───────────────────────────────────────────────
        setV('conv-mockboat',   dutyScore);
        setV('conv-logbook',    logScore);
        setV('conv-patriotism', patriotismScore);
        setV('conv-icpe',       icpeScore);

        // ── Update the hint banner ────────────────────────────────────
        const hint = document.getElementById('conv-cadet-hint');
        if (hint) {
            hint.className =
                'text-[10px] mt-2 p-2.5 bg-brand-green-glow dark:bg-green-900/20 ' +
                'rounded border border-brand-green/30 dark:border-green-800 flex flex-wrap ' +
                'gap-x-3 gap-y-1 items-center';
            hint.innerHTML =
                `<span class="text-brand-green dark:text-green-400 font-bold">✓ Loaded: ${c.name}</span>` +
                `<span class="text-slate-500">|</span>` +
                `<span>Duties: <b class="text-brand-blue dark:text-blue-400">${dutyScore}</b></span>` +
                `<span>Logbook: <b class="text-brand-blue dark:text-blue-400">${logScore}</b></span>` +
                `<span>Merits: <b class="text-brand-blue dark:text-blue-400">${patriotismScore}</b></span>` +
                `<span>GWA→ICPE: <b class="text-brand-blue dark:text-blue-400">${icpeScore}</b></span>`;
        }

        // ── Trigger live calculation ──────────────────────────────────
        if (window.converterLiveCalc) window.converterLiveCalc();
    };

    function setV(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    // ─────────────────────────────────────────────────────────────────
    // FIX 2B: Inject UI elements into the Manual Grade Converter panel
    //   — "Load Selected Cadet" button next to the name field
    //   — A hint/status bar under the inputs
    // ─────────────────────────────────────────────────────────────────
    function injectConverterUI() {
        // Guard: don't inject twice
        if (document.getElementById('conv-load-cadet-btn')) return;

        const nameInput = document.getElementById('conv-cadetName');
        if (!nameInput) return; // modal not opened yet — will retry

        // ── Build the "Load" button ───────────────────────────────────
        const btn = document.createElement('button');
        btn.id        = 'conv-load-cadet-btn';
        btn.type      = 'button';
        btn.title     = 'Auto-fill from the cadet currently open in the Appraisal Board';
        btn.className =
            'flex items-center gap-1.5 bg-brand-green hover:bg-green-700 ' +
            'text-white font-bold py-2 px-3 rounded-lg text-[11px] transition ' +
            'shadow-sm whitespace-nowrap self-end shrink-0';
        btn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" ' +
            'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
            '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
            '<polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
            '&nbsp;Load Selected Cadet';
        btn.addEventListener('click', window.loadCadetIntoConverter);

        // ── Wrap the name's parent cell to include the button ─────────
        const nameCell = nameInput.closest('div.flex-col') || nameInput.parentElement;
        if (nameCell) {
            const wrapper = document.createElement('div');
            wrapper.className = 'flex gap-2 items-end col-span-1';
            // clone the original label+input wrapper into a flex-1 div
            const inner = document.createElement('div');
            inner.className = 'flex flex-col flex-1';
            while (nameCell.firstChild) inner.appendChild(nameCell.firstChild);
            wrapper.appendChild(inner);
            wrapper.appendChild(btn);
            nameCell.appendChild(wrapper);
        }

        // ── Inject hint bar ───────────────────────────────────────────
        const scoreBox = document.querySelector(
            '.bg-slate-50.dark\\:bg-slate-800.p-4.border.border-slate-200.dark\\:border-slate-700.rounded-xl'
        );
        if (scoreBox && !document.getElementById('conv-cadet-hint')) {
            const hint = document.createElement('div');
            hint.id = 'conv-cadet-hint';
            // starts hidden; loadCadetIntoConverter will show it
            hint.className = 'hidden';
            scoreBox.parentElement.insertBefore(hint, scoreBox);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Intercept openFormulasModal to inject UI when the modal opens
    // ─────────────────────────────────────────────────────────────────
    function patchOpenFormulas() {
        const original = window.openFormulasModal;
        if (!original) { setTimeout(patchOpenFormulas, 500); return; }

        window.openFormulasModal = function () {
            original.apply(this, arguments);
            // Give the DOM a tick to render then inject
            requestAnimationFrame(() => {
                setTimeout(injectConverterUI, 80);
            });
        };
    }

    // ─────────────────────────────────────────────────────────────────
    // Also patch switchMatrixTab so injection runs when user switches
    // to the "Formula & Converter" tab
    // ─────────────────────────────────────────────────────────────────
    function patchSwitchTab() {
        const original = window.switchMatrixTab;
        if (!original) { setTimeout(patchSwitchTab, 500); return; }

        window.switchMatrixTab = function (tab) {
            original.apply(this, arguments);
            if (tab === 'formula') {
                requestAnimationFrame(() => setTimeout(injectConverterUI, 80));
            }
        };
    }

    // ─────────────────────────────────────────────────────────────────
    // FIX 3: Prevent false "Cadet Not Found" by waiting for cloud sync
    // ─────────────────────────────────────────────────────────────────
    function patchCadetLogin() {
        const originalLogin = window.loginAsCadet;
        if (!originalLogin) { setTimeout(patchCadetLogin, 500); return; }

        window.loginAsCadet = function (event) {
            // Block login if the cadets array hasn't populated yet
            if (!window.cadets || window.cadets.length === 0) {
                const msg = "📡 Database is still syncing from the cloud. Please wait 3-5 seconds and try again.";
                if (window.customAlert) {
                    window.customAlert(msg);
                } else {
                    alert(msg);
                }
                return; // Stop the execution here
            }
            // If data is ready, proceed normally
            originalLogin.apply(this, arguments);
        };
    }

    // -----------------------------------------------------------------
    // Boot - wait for main app functions to be available
    // -----------------------------------------------------------------
    function boot() {
        if (
            typeof window.recalculateMetrics === 'function' &&
            typeof window.openFormulasModal  === 'function' &&
            typeof window.switchMatrixTab    === 'function'
        ) {
            patchRecalculate();
            patchOpenFormulas();
            patchSwitchTab();
            patchCadetLogin(); // <--- This is the new trigger
        } else {
            setTimeout(boot, 300);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

})();
