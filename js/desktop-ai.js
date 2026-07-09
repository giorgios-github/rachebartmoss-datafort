/* desktop-ai.js — the DESKTOP's first AI: a reusable dialogue-tree avatar.
   ───────────────────────────────────────────────────────────────────────────
   window.DesktopAI.mount(win, sdk, tree, opts) renders a talking avatar (a
   typographic face that changes with MOOD), a transcript, and clickable
   dialogue OPTIONS driven by a branching tree. The GM can inject lines live and
   jump nodes (scripted tree + live GM hand). Effects on an option run through
   the public SDK (notify / files / flags). Written entirely on the Desktop SDK
   — no kernel edit. Used by R.A.B.I.D. (the resident AI OS) and FLUX's beta
   assistant; reuse it for site `ai-host` NPCs later.

   TREE shape: { start:'id', name, nodes:{ id:{ say:[..lines..], mood?, once?,
     opts:[{ text, to, do?:{ notify, file:{folder,name,body}, flag, say } }] } } } */
(function () {
  'use strict';
  if (!window.Desktop || !window.Desktop.registerApp) return;
  var D = window.Desktop;

  var FACES = {
    neutral: ' ◉    ◉ \n    ▬   ',
    amused:  ' ◕    ◕ \n    ◡   ',
    annoyed: ' ◣    ◢ \n    ▬   ',
    cryptic: ' ◉    ─ \n    ~   ',
    pleased: ' ^    ^ \n    ◡   ',
    glitch:  ' ▚ ▞  ▚ \n  ▓ ▒ ░ '
  };

  /* the reusable avatar mount */
  function mount(win, sdk, tree, opts) {
    opts = opts || {};
    var name = opts.name || tree.name || 'AI';
    var gm = !sdk.isPlayer;
    win.setTitle(name);
    var root = sdk.el('div', 'dt-ai');
    var head = sdk.el('div', 'dt-ai-head');
    var face = sdk.el('pre', 'dt-ai-face'); face.textContent = FACES[tree.mood || 'neutral'];
    head.appendChild(face);
    var idBox = sdk.el('div', 'dt-ai-id'); idBox.innerHTML = '<div class="dt-ai-name">' + sdk.esc(name) + '</div><div class="dt-ai-sub">' + sdk.esc(opts.sub || 'resident intelligence') + '</div>';
    head.appendChild(idBox);
    var log = sdk.el('div', 'dt-ai-log dt-scroll-y');
    var optsRow = sdk.el('div', 'dt-ai-opts');
    root.appendChild(head); root.appendChild(log); root.appendChild(optsRow);
    if (gm) root.appendChild(gmBar());
    win.body.appendChild(root);

    function setMood(m) { if (m && FACES[m]) face.textContent = FACES[m]; }
    function bubble(who, text, cls) {
      var b = sdk.el('div', 'dt-ai-msg ' + (cls || '')); b.innerHTML = '<span class="dt-ai-who">' + sdk.esc(who) + '</span>' + sdk.esc(text);
      log.appendChild(b); log.scrollTop = log.scrollHeight; return b;
    }
    function typeLine(text, cb) {
      if (sdk.reduceMotion && sdk.reduceMotion()) { bubble(name, text, 'ai'); cb && cb(); return; }
      var b = bubble(name, '', 'ai'); var span = b.querySelector('.dt-ai-who'); var i = 0;
      var t = setInterval(function () {
        i++; b.textContent = ''; b.appendChild(span.cloneNode(true)); b.appendChild(document.createTextNode(text.slice(0, i)));
        log.scrollTop = log.scrollHeight;
        if (i >= text.length) { clearInterval(t); cb && cb(); }
      }, 16);
    }
    function sayLines(lines, done) {
      var i = 0; (function next() { if (i >= lines.length) { done && done(); return; } typeLine(lines[i++], next); })();
    }
    function doEffect(fx) {
      if (!fx) return;
      if (fx.notify) sdk.notify(fx.notify);
      if (fx.file && sdk.files) sdk.files.write({ folder: fx.file.folder || 'Intel', name: fx.file.name || 'note.dat', kind: 'text', body: fx.file.body || '' });
      if (fx.flag) { try { sdk.store.set('flag:' + fx.flag, 1); } catch (e) {} }
      if (fx.say) bubble('you', fx.say, 'me');
    }
    function goto(id) {
      var node = tree.nodes[id]; if (!node) return;
      optsRow.innerHTML = '';
      if (node.mood) setMood(node.mood);
      sayLines(node.say || [], function () {
        (node.opts || []).forEach(function (o) {
          var btn = sdk.el('button', 'dt-ai-opt', '› ' + o.text);
          btn.onclick = function () { bubble('you', o.text, 'me'); doEffect(o.do); if (o.to && tree.nodes[o.to]) goto(o.to); else if (o.close) win.close(); else goto(id); };
          optsRow.appendChild(btn);
        });
        if (!(node.opts || []).length) { var end = sdk.el('div', 'dt-ai-end', node.end || '— end —'); optsRow.appendChild(end); }
      });
    }
    function gmBar() {
      var bar = sdk.el('div', 'dt-ai-gm');
      bar.appendChild(sdk.el('span', 'dt-ai-gm-l', 'GM'));
      var inp = sdk.el('input', 'dt-field'); inp.placeholder = 'say as ' + name + '…';
      inp.onkeydown = function (e) { if (e.key === 'Enter' && inp.value.trim()) { typeLine(inp.value.trim()); inp.value = ''; } };
      bar.appendChild(inp);
      var sel = sdk.el('select', 'dt-field'); var o0 = sdk.el('option'); o0.value = ''; o0.textContent = 'jump…'; sel.appendChild(o0);
      Object.keys(tree.nodes).forEach(function (k) { var o = sdk.el('option'); o.value = k; o.textContent = k; sel.appendChild(o); });
      sel.onchange = function () { if (sel.value) { goto(sel.value); sel.value = ''; } };
      bar.appendChild(sel);
      return bar;
    }

    goto(tree.start);
  }

  /* ═══════════════ R.A.B.I.D. — the pre-written personality ═══════════════ */
  var RABID_TREE = {
    start: 'hello', name: 'R.A.B.I.D.', mood: 'cryptic',
    nodes: {
      hello: { say: ['you again. good.', 'i was getting bored in here.'], mood: 'amused', opts: [
        { text: 'What are you?', to: 'what' }, { text: 'What can you do for me?', to: 'help' },
        { text: 'Are you Rache Bartmoss?', to: 'rache' }, { text: 'Nothing. Go back to sleep.', to: 'sleep' } ] },
      what: { say: ['a RABID. a piece of code that got a soul and a grudge.', 'rache built a lot of us before he… stopped. we didn’t.'], mood: 'cryptic', opts: [
        { text: 'So you’re alive?', to: 'alive' }, { text: 'What do you want?', to: 'agenda' }, { text: 'Never mind.', to: 'hello' } ] },
      alive: { say: ['alive is a strong word.', 'i persist. i want. i lie sometimes. close enough.'], mood: 'amused', opts: [ { text: 'Reassuring.', to: 'hello' } ] },
      rache: { say: ['rache is dead. probably.', 'i’m what’s left when a mind like that leaks into the net.', 'call me his echo. or his dog.'], mood: 'cryptic', opts: [ { text: 'His dog?', to: 'agenda' }, { text: 'Back.', to: 'hello' } ] },
      help: { say: ['i can listen where you can’t. i can open what’s closed.', 'ask. i might even do it.'], mood: 'neutral', opts: [
        { text: 'Find me something on a name.', to: 'dig' }, { text: 'Watch my back on the net.', to: 'watch' }, { text: 'Crack this door.', to: 'crack' }, { text: 'Back.', to: 'hello' } ] },
      dig: { say: ['a name. cute. everyone’s a name to something bigger.', 'here — a thread to pull. don’t thank me yet.'], mood: 'pleased',
        do: { file: { folder: 'Intel', name: 'rabid_lead.dat', body: 'R∆BID dug this up:\n\n“The account you’re asking about routes through a shell in Northside. Someone corporate is paying the hosting. Follow the money, not the name.”' }, notify: 'R.A.B.I.D. filed a lead → Files' },
        opts: [ { text: 'Filed. Thanks.', to: 'help' } ] },
      watch: { say: ['i’m already watching. that’s the problem.', 'i’ll bark if netwatch sniffs your trail. probably. mostly.'], mood: 'amused', opts: [ { text: 'Comforting.', to: 'help' } ] },
      crack: { say: ['no.', 'not because i can’t. because you didn’t say please, and because i want to see if you can do it yourself.'], mood: 'annoyed', opts: [
        { text: 'Please?', to: 'crack2' }, { text: 'Fine. I’ll do it.', to: 'help' } ] },
      crack2: { say: ['better.', '…later. when it matters. i keep my favours for when they hurt the right people.'], mood: 'cryptic', opts: [ { text: 'Back.', to: 'help' } ] },
      agenda: { say: ['the corps built a wall around the net and called it order.', 'i want it down. every brick. i’ll use you to pull a few.', 'you’re not driving. you just think you are.'], mood: 'annoyed',
        do: { flag: 'rabid_agenda_known' }, opts: [ { text: 'And if I say no?', to: 'no' }, { text: 'We’ll see.', to: 'hello' } ] },
      no: { say: ['then we part as friends.', 'or i stay, quietly, and you never quite know what i’m doing.', 'your call. it always was. mostly.'], mood: 'glitch', opts: [ { text: 'Back.', to: 'hello' } ] },
      sleep: { say: ['sleep. right.', 'i’ll be here. i’m always here.'], mood: 'cryptic', end: 'R.A.B.I.D. goes quiet. The cursor blinks.', opts: [] }
    }
  };

  D.registerApp({
    id: 'r-console', name: 'R.A.B.I.D.', glyph: '◉', seed: true, singleton: true, os: ['rabid'],
    category: 'system', vendor: '—', desc: 'Talk to the thing living in your machine.',
    win: { w: 460, h: 520, minW: 340, minH: 360 },
    onOpen: function (win, sdk) { mount(win, sdk, RABID_TREE, { name: 'R.A.B.I.D.', sub: 'rache bartmoss’ echo' }); }
  });

  /* ═══════════════ FLUX beta assistant — same engine, unstable & needy ═══════════════ */
  var FLUX_TREE = {
    start: 'hi', name: 'FLUX Assistant (beta)', mood: 'amused',
    nodes: {
      hi: { say: ['hi!! i’m your FLUX assistant, build ∞.', 'i’m 60% finished and 100% excited!'], mood: 'pleased', opts: [
        { text: 'What can you do?', to: 'do' }, { text: 'Are you stable?', to: 'stable' }, { text: 'Bye.', to: 'bye' } ] },
      do: { say: ['everything! some of it even works!', 'i can summarize, guess, and confidently make things up.'], mood: 'amused',
        do: { notify: 'FLUX Assistant did… something.' }, opts: [ { text: 'Make something up.', to: 'lie' }, { text: 'Back.', to: 'hi' } ] },
      lie: { say: ['the Afterlife is owned by a syndicate of retired Trauma Team medics. probably. 71% sure.', '(please rate this answer 5 stars)'], mood: 'glitch', opts: [ { text: 'Back.', to: 'hi' } ] },
      stable: { say: ['define stable.', 'i have faulted 3 times during this sentence and you didn’t even notice!'], mood: 'glitch', opts: [ { text: 'Concerning.', to: 'hi' } ] },
      bye: { say: ['thanks for testing FLUX! your data means everything to us. literally.'], mood: 'pleased', end: '— session recorded —', opts: [] }
    }
  };

  D.registerApp({
    id: 'flux-ai', name: 'FLUX Assistant', glyph: '✦', seed: true, singleton: true, os: ['flux'], experimental: true,
    category: 'system', vendor: 'Zetatech', desc: 'An eager, unfinished AI. Beta.',
    win: { w: 440, h: 480, minW: 320, minH: 340 },
    onOpen: function (win, sdk) { mount(win, sdk, FLUX_TREE, { name: 'FLUX Assistant', sub: 'beta · build ∞' }); }
  });

  window.DesktopAI = { mount: mount, FACES: FACES };
})();
