/* =========================================================
   IMB GAME CENTER - 6 QUI PREND ! (Pont Firebase SDK & Classement)
   Remplace _sdk.js et _prefill.js
   Salons : rooms/6-qui-prend/<CODE>
   Classement : scores/6-qui-prend/<tag>
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
      let onPlayersValue = null;
      let onMessageAdded = null;

      function emit(evt, a, b) {
        (L[evt] || []).forEach(function (fn) {
          try { fn(a, b); } catch (e) { console.error(e); }
        });
      }

      const roomRef = db.ref('rooms/6-qui-prend/' + c);

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

          if (o && o.keep) {
            await roomRef.child('lastState').set({
              data: data,
              from: { id: user.tag, name: user.nickname || user.tag },
              timestamp: now
            });
          }

          const msgRef = roomRef.child('messages').push();
          await msgRef.set({
            data: data,
            from: { id: user.tag, name: user.nickname || user.tag },
            timestamp: now
          });
        },
        leave: function () {
          if (closed) return;
          closed = true;

          if (playersRef && onPlayersValue) playersRef.off('value', onPlayersValue);
          if (messagesRef && onMessageAdded) messagesRef.off('child_added', onMessageAdded);

          if (window.GameShell && window.GameShell.currentUser) {
            const tag = window.GameShell.currentUser.tag;
            roomRef.child('players/' + tag).remove().catch(() => {});
          }
          if (window.GameShell) {
            window.GameShell.currentRoomCode = null;
          }
          try {
            localStorage.removeItem('imb_active_room_6-qui-prend');
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
          const roomExists = Boolean(roomData && (roomData.createdAt || roomData.lastState || (roomData.players && Object.keys(roomData.players).length > 0)));

          if (!roomExists && opts && opts.create === false) {
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
            localStorage.setItem('imb_active_room_6-qui-prend', c);
            window.location.hash = 'room=' + c;
          } catch (e) {}

          const myPlayerRef = roomRef.child('players/' + user.tag);
          const existingSnap = await myPlayerRef.once('value');
          const existingPlayer = existingSnap.val();
          const joinedAt = (existingPlayer && existingPlayer.joinedAt) ? existingPlayer.joinedAt : Date.now();
          const myAvatarUri = emojiToDataUri(user.avatarEmoji || '🍺');

          await myPlayerRef.set({
            id: user.tag,
            name: user.nickname || user.tag,
            avatar: myAvatarUri,
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
          const lastStateVal = lastStateSnap.val();
          const joinTimestamp = Date.now();

          emit('ready', {
            me: user.tag,
            players: initialPlayers,
            last: lastStateVal ? lastStateVal.data : null
          });

          playersRef = roomRef.child('players');
          onPlayersValue = function (pSnap) {
            if (closed) return;
            emit('players', sortPlayers(pSnap.val()));
          };
          playersRef.on('value', onPlayersValue);

          messagesRef = roomRef.child('messages').orderByChild('timestamp').startAt(joinTimestamp - 200);
          onMessageAdded = function (mSnap) {
            if (closed) return;
            const msg = mSnap.val();
            if (!msg || !msg.data) return;
            emit('message', msg.data, msg.from || {});
          };
          messagesRef.on('child_added', onMessageAdded);

        } catch (err) {
          console.error('Erreur salon 6 qui prend :', err);
          if (!closed) emit('error', 'Impossible de joindre la salle');
        }
      })();

      return channel;
    },

    createInvite: async function (opts) {
      opts = opts || {};
      const user = await waitForShellUser();
      const roomCode = (opts.room || (window.GameShell && window.GameShell.currentRoomCode) || '').toUpperCase();
      if (!roomCode) throw new Error('Code de salle manquant');

      const text = opts.message
        ? `@promo ${opts.message} — Code : ${roomCode}`
        : `@promo Venez jouer au 6 qui prend ! 🐮💀 — Code : ${roomCode}`;

      await db.ref('chat').push({
        authorNick: user.nickname,
        authorTag: user.tag,
        authorAvatar: user.avatarEmoji || '🍺',
        authorFlag: user.flagEmoji || '🇫🇷',
        isInvite: true,
        gameTitle: '🐮 6 qui prend !',
        internalGame: '6-qui-prend',
        internalRoom: roomCode,
        text: text,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      });

      return {
        code: roomCode,
        link: `${window.location.origin}/games/6-qui-prend/index.html#room=${roomCode}`
      };
    },

    debutPartie: function () {
      return Promise.resolve({
        run: '6qp-' + Date.now(),
        seed: 1 + Math.floor(Math.random() * 2147483646)
      });
    },

    finPartie: async function (o) {
      o = o || {};
      const user = await waitForShellUser();
      if (!user || !user.tag) return { counted: false, record: false };

      const won = Boolean(o.gagne !== undefined ? o.gagne : o.won);
      const bullsScore = typeof o.score === 'number' ? o.score : null;
      const matchId = String(o.partie || o.match || ('6qp-' + Date.now()));

      const ref = db.ref('scores/6-qui-prend/' + user.tag);
      await ref.transaction(function (current) {
        if (!current) {
          return {
            tag: user.tag,
            nickname: user.nickname || user.tag,
            avatarEmoji: user.avatarEmoji || '🍺',
            wins: won ? 1 : 0,
            losses: won ? 0 : 1,
            plays: 1,
            bestBulls: bullsScore,
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
        if (bullsScore !== null && (typeof current.bestBulls !== 'number' || bullsScore < current.bestBulls)) {
          current.bestBulls = bullsScore;
        }
        current.lastMatchId = matchId;
        current.updatedAt = Date.now();
        return current;
      });

      if (won && window.GameShell && typeof window.GameShell.fireConfetti === 'function') {
        window.GameShell.fireConfetti();
      }

      return { counted: true, record: won };
    },

    classement: async function () {
      const user = await waitForShellUser();
      const snap = await db.ref('scores/6-qui-prend').once('value');
      const data = snap.val() || {};

      const sorted = Object.values(data).sort((a, b) => {
        if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
        return (a.bestBulls ?? 999) - (b.bestBulls ?? 999);
      });

      const rows = sorted.map((p, idx) => ({
        id: p.tag,
        name: `${p.avatarEmoji || '🍺'} ${p.nickname}`,
        wins: p.wins || 0,
        plays: p.plays || 0,
        best: p.bestBulls ?? null,
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
