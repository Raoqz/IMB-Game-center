/* =========================================================
   IMB GAME CENTER - CATAN (Pont Firebase SDK Corrigé)
   Stockage salon : rooms/catan/<CODE>
   Stockage scores : scores/catan/<tag>
   ========================================================= */
(function () {
  'use strict';

  function waitForShellUser() {
    return new Promise((resolve) => {
      if (window.GameShell && window.GameShell.currentUser) {
        return resolve(window.GameShell.currentUser);
      }
      const iv = setInterval(() => {
        if (window.GameShell && window.GameShell.currentUser) {
          clearInterval(iv);
          resolve(window.GameShell.currentUser);
        }
      }, 60);
    });
  }

  function emojiToDataUri(emoji) {
    const safeEmoji = emoji || '🍺';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text x="50%" y="54%" dominant-baseline="central" text-anchor="middle" font-size="40">${safeEmoji}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function getRoomFromUrl() {
    const q = new URLSearchParams(window.location.search).get('room');
    if (q) return q.trim().toUpperCase();
    const match = window.location.hash.match(/room=([A-Z0-9]{4,12})/i);
    return match ? match[1].toUpperCase() : null;
  }

  /**
   * Restaure les objets/tableaux vides que Firebase Realtime Database
   * aurait pu supprimer si un état non-sérialisé était présent.
   */
  function normalizePayload(raw) {
    if (!raw) return null;
    let parsed = raw;
    if (typeof raw.payloadJson === 'string') {
      try { parsed = JSON.parse(raw.payloadJson); } catch (e) {}
    } else if (raw.data !== undefined) {
      parsed = raw.data;
    }

    if (parsed && parsed.t === 'state' && parsed.s) {
      const s = parsed.s;
      s.bld = s.bld || {};
      s.rd = s.rd || {};
      s.disc = s.disc || {};
      s.lens = Array.isArray(s.lens) ? s.lens : [];
      s.ev = Array.isArray(s.ev) ? s.ev : [];
      s.log = Array.isArray(s.log) ? s.log : [];
      if (typeof s.deck !== 'string') s.deck = '';
      if (Array.isArray(s.players)) {
        s.players.forEach(p => {
          p.r = Array.isArray(p.r) ? p.r : [0, 0, 0, 0, 0];
          p.dev = Object.assign({ K: 0, R: 0, Y: 0, M: 0, V: 0 }, p.dev || {});
          p.nd = Object.assign({ K: 0, R: 0, Y: 0, M: 0, V: 0 }, p.nd || {});
        });
      }
    }
    return parsed;
  }

  window.ChadGang = {
    hubUrl: window.location.origin,

    me: async function () {
      const user = await waitForShellUser();
      return {
        id: user.tag,
        name: user.nickname || user.tag,
        avatar: emojiToDataUri(user.avatarEmoji || '🍺'),
        isAdmin: user.role === 'admin',
        roles: user.role === 'admin' ? ['admin'] : [],
        isModo: user.role === 'admin'
      };
    },

    isAdmin: async function () {
      const user = await waitForShellUser();
      return user.role === 'admin';
    },

    room: function () {
      return getRoomFromUrl();
    },

    join: function (code, opts) {
      const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
      const L = { ready: [], players: [], message: [], error: [] };
      let closed = false;
      let playersRef = null;
      let messagesRef = null;
      let lastStateRef = null;
      let onPlayersValue = null;
      let onMessageAdded = null;
      let onLastStateValue = null;

      function emit(evt, a, b) {
        (L[evt] || []).forEach(function (fn) {
          try { fn(a, b); } catch (e) { console.error(e); }
        });
      }

      const roomRef = db.ref('rooms/catan/' + c);

      const channel = {
        code: c,
        me: null,
        on: function (evt, fn) {
          (L[evt] = L[evt] || []).push(fn);
          return channel;
        },
        send: async function (data, o) {
          if (closed) return;
          const user = await waitForShellUser();
          const now = Date.now();
          const payloadJson = JSON.stringify(data);
          const sender = { id: user.tag, name: user.nickname || user.tag };

          // Si keep: true (état de la partie), on met à jour lastState (écouté en direct par tous)
          if (o && o.keep) {
            await roomRef.child('lastState').set({
              payloadJson: payloadJson,
              from: sender,
              timestamp: now
            });
          }

          // Diffuser le message à tous les joueurs de la salle
          const msgRef = roomRef.child('messages').push();
          await msgRef.set({
            payloadJson: payloadJson,
            from: sender,
            timestamp: now
          });
        },
        leave: function () {
          if (closed) return;
          closed = true;

          if (playersRef && onPlayersValue) playersRef.off('value', onPlayersValue);
          if (messagesRef && onMessageAdded) messagesRef.off('child_added', onMessageAdded);
          if (lastStateRef && onLastStateValue) lastStateRef.off('value', onLastStateValue);

          if (window.GameShell && window.GameShell.currentUser) {
            const tag = window.GameShell.currentUser.tag;
            roomRef.child('players/' + tag).remove().catch(() => {});
          }
          if (window.GameShell) {
            window.GameShell.currentRoomCode = null;
          }
          try {
            localStorage.removeItem('imb_active_room_catan');
            history.replaceState(null, '', window.location.pathname);
          } catch (e) {}
        }
      };

      (async function initRoomConnection() {
        try {
          const user = await waitForShellUser();
          if (closed) return;

          const snap = await roomRef.once('value');
          if (closed) return;

          const roomData = snap.val();
          const hasPlayers = roomData && roomData.players && Object.keys(roomData.players).length > 0;
          const hasState = roomData && (roomData.lastState || roomData.createdAt);

          if (!hasPlayers && !hasState && opts && opts.create === false) {
            emit('error', 'Salle introuvable : vérifie le code');
            return;
          }

          if (!roomData || !roomData.createdAt) {
            await roomRef.child('createdAt').set(Date.now());
          }

          channel.me = user.tag;

          if (window.GameShell) {
            window.GameShell.currentRoomCode = c;
          }
          try {
            localStorage.setItem('imb_active_room_catan', c);
            if (window.location.hash !== '#room=' + c) {
              history.replaceState(null, '', window.location.pathname + '#room=' + c);
            }
          } catch (e) {}

          const myPlayerRef = roomRef.child('players/' + user.tag);
          const existingPlayerSnap = await myPlayerRef.once('value');
          const existingPlayer = existingPlayerSnap.val();
          const joinedAt = (existingPlayer && existingPlayer.joinedAt) ? existingPlayer.joinedAt : Date.now();

          await myPlayerRef.set({
            id: user.tag,
            name: user.nickname || user.tag,
            avatar: emojiToDataUri(user.avatarEmoji || '🍺'),
            joinedAt: joinedAt
          });
          myPlayerRef.onDisconnect().remove();

          const sortPlayers = (map) => {
            return Object.values(map || {})
              .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
              .map(p => ({ id: p.id, name: p.name, avatar: p.avatar || null }));
          };

          const allPlayersSnap = await roomRef.child('players').once('value');
          const initialPlayers = sortPlayers(allPlayersSnap.val());

          const lastStateSnap = await roomRef.child('lastState').once('value');
          const initialLastState = normalizePayload(lastStateSnap.val());

          // Mémoriser les clés des anciens messages pour n'écouter que les nouveaux (sans dépendre de l'horloge du PC)
          const existingMsgsSnap = await roomRef.child('messages').limitToLast(30).once('value');
          const seenMsgKeys = new Set(Object.keys(existingMsgsSnap.val() || {}));

          if (closed) return;

          // 1. Émettre 'ready'
          emit('ready', {
            me: user.tag,
            players: initialPlayers,
            last: initialLastState
          });

          // 2. Écouter les joueurs en direct
          playersRef = roomRef.child('players');
          onPlayersValue = function (pSnap) {
            if (closed) return;
            emit('players', sortPlayers(pSnap.val()));
          };
          playersRef.on('value', onPlayersValue);

          // 3. Écouter lastState en direct (garantit que le lancement de partie arrive toujours instantanément)
          lastStateRef = roomRef.child('lastState');
          let isFirstLastState = true;
          onLastStateValue = function (lSnap) {
            if (closed) return;
            if (isFirstLastState) {
              isFirstLastState = false;
              return;
            }
            const val = lSnap.val();
            const payload = normalizePayload(val);
            if (payload) {
              emit('message', payload, (val && val.from) || {});
            }
          };
          lastStateRef.on('value', onLastStateValue);

          // 4. Écouter tous les nouveaux messages en direct
          messagesRef = roomRef.child('messages').limitToLast(25);
          onMessageAdded = function (mSnap) {
            if (closed) return;
            if (seenMsgKeys.has(mSnap.key)) return;
            seenMsgKeys.add(mSnap.key);

            const msg = mSnap.val();
            const payload = normalizePayload(msg);
            if (!payload) return;
            emit('message', payload, (msg && msg.from) || {});
          };
          messagesRef.on('child_added', onMessageAdded);

        } catch (err) {
          console.error('Erreur connexion salon Catan :', err);
          if (!closed) emit('error', 'Impossible de joindre la salle Catan');
        }
      })();

      return channel;
    },

    createInvite: async function (opts) {
      opts = opts || {};
      const user = await waitForShellUser();
      const roomCode = (opts.room || (window.GameShell && window.GameShell.currentRoomCode) || '').toUpperCase();
      if (!roomCode) throw new Error('Code de salle manquant');

      const extraInfo = opts.version ? ` (${opts.version})` : '';
      const text = opts.message
        ? `@promo ${opts.message}${extraInfo} — Code : ${roomCode}`
        : `@promo Venez coloniser Catan ! 🏝️${extraInfo} — Code : ${roomCode}`;

      await db.ref('chat').push({
        authorNick: user.nickname,
        authorTag: user.tag,
        authorAvatar: user.avatarEmoji || '🍺',
        authorFlag: user.flagEmoji || '🇫🇷',
        isInvite: true,
        gameTitle: '🏝️ Catan',
        internalGame: 'catan',
        internalRoom: roomCode,
        text: text,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      });

      return {
        code: roomCode,
        link: `${window.location.origin}/games/catan/index.html#room=${roomCode}`
      };
    },

    debutPartie: function () {
      return Promise.resolve({
        run: 'catan-' + Date.now(),
        seed: 1 + Math.floor(Math.random() * 2147483646)
      });
    },

    finPartie: async function (o) {
      o = o || {};
      const user = await waitForShellUser();
      if (!user || !user.tag) return { counted: false, record: false };

      const won = Boolean(o.gagne !== undefined ? o.gagne : o.won);
      const vpScore = typeof o.score === 'number' ? o.score : 0;
      const matchId = String(o.partie || o.match || ('catan-' + Date.now()));

      const ref = db.ref('scores/catan/' + user.tag);
      let isNewRecord = false;

      await ref.transaction(function (current) {
        if (!current) {
          isNewRecord = won;
          return {
            tag: user.tag,
            nickname: user.nickname || user.tag,
            avatarEmoji: user.avatarEmoji || '🍺',
            wins: won ? 1 : 0,
            losses: won ? 0 : 1,
            plays: 1,
            best: vpScore,
            lastMatchId: matchId,
            updatedAt: Date.now()
          };
        }
        if (current.lastMatchId === matchId) {
          return current;
        }
        current.nickname = user.nickname || current.nickname;
        current.avatarEmoji = user.avatarEmoji || current.avatarEmoji || '🍺';
        current.wins = (current.wins || 0) + (won ? 1 : 0);
        current.losses = (current.losses || 0) + (won ? 0 : 1);
        current.plays = (current.plays || 0) + 1;
        if (vpScore > (current.best || 0)) {
          current.best = vpScore;
          isNewRecord = true;
        }
        current.lastMatchId = matchId;
        current.updatedAt = Date.now();
        return current;
      });

      if (won && window.GameShell && typeof window.GameShell.fireConfetti === 'function') {
        window.GameShell.fireConfetti();
      }

      return { counted: true, record: isNewRecord };
    },

    classement: async function () {
      const user = await waitForShellUser();
      const snap = await db.ref('scores/catan').once('value');
      const data = snap.val() || {};

      const sorted = Object.values(data).sort((a, b) => {
        if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
        return (b.best || 0) - (a.best || 0);
      });

      const rows = sorted.map((p, idx) => ({
        id: p.tag,
        name: `${p.avatarEmoji || '🍺'} ${p.nickname}`,
        wins: p.wins || 0,
        plays: p.plays || 0,
        best: p.best || 0,
        rank: idx + 1,
        you: Boolean(user && p.tag === user.tag)
      }));

      return {
        mode: 'victoires',
        unit: 'victoires',
        rows: rows,
        me: rows.find(r => r.you) || null
      };
    }
  };

  window.ChadGang.reportResult = window.ChadGang.finPartie;
})();
