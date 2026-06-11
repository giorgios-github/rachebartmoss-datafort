/* app.js — the desktop app shell entry.
   Phase C1: role chooser. GM → campaign manager (gm.html for now), Player →
   connect flow (join.html for now). Later phases (C2–C7) replace these targets
   with the in-app campaign manager / session dashboard / player connect.
   English UI. */
(function () {
  'use strict';
  var ROLE_KEY = 'bartmoss_app_role';

  window.chooseRole = function (role) {
    try { localStorage.setItem(ROLE_KEY, role); } catch (e) {}
    if (role === 'gm') {
      // Phase C1: route to the existing GM dashboard (campaign "main").
      // C3 will replace this with the in-app Campaign Manager.
      location.href = 'gm.html?campaign=main';
    } else {
      // Phase C1: route to the player join helper.
      // C6 will replace this with the in-app player shell + CONNECT.
      location.href = 'join.html';
    }
  };

  // The chooser is always shown at launch (the user "lands on a popup").
  // We remember the last choice only to pre-highlight it.
  try {
    var last = localStorage.getItem(ROLE_KEY);
    if (last) {
      var el = document.querySelector('.rc-role[onclick*="' + last + '"]');
      if (el) el.style.borderColor = '#b8860b';
    }
  } catch (e) {}
})();
