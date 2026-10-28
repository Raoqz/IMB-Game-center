/* =========================================================
   IMB CASINO - ROULETTE ENGINE & BETTING API (Étape 1)
   ========================================================= */
(function () {
  'use strict';

  // Les 37 cases de la roulette européenne (0 à 36)
  const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

  function getNumberColor(num) {
    if (num === 0) return 'green';
    return RED_NUMBERS.includes(num) ? 'red' : 'black';
  }

  /**
   * Calcule les gains d'un joueur en fonction des paris posés et du numéro gagnant.
   * paris : objet ex { "straight_17": 50, "red": 100, "col_1": 25 }
   */
  function calculateWinnings(winningNumber, bets) {
    let totalWin = 0;
    const winColor = getNumberColor(winningNumber);
    const isEven = winningNumber !== 0 && winningNumber % 2 === 0;
    const isOdd = winningNumber !== 0 && winningNumber % 2 !== 0;
    const isLow = winningNumber >= 1 && winningNumber <= 18;
    const isHigh = winningNumber >= 19 && winningNumber <= 36;
    
    // Détermination de la colonne (1, 2 ou 3)
    let col = 0;
    if (winningNumber > 0) {
      if (winningNumber % 3 === 1) col = 1;
      else if (winningNumber % 3 === 2) col = 2;
      else col = 3;
    }

    // Détermination de la douzaine (1, 2 ou 3)
    let dozen = 0;
    if (winningNumber >= 1 && winningNumber <= 12) dozen = 1;
    else if (winningNumber >= 13 && winningNumber <= 24) dozen = 2;
    else if (winningNumber >= 25 && winningNumber <= 36) dozen = 3;

    for (const [betKey, amount] of Object.entries(bets)) {
      const stake = Number(amount);
      if (isNaN(stake) || stake <= 0) continue;

      let won = false;
      let payoutMultiplier = 0; // x36 pour plein, x2 pour chances simples, etc.

      if (betKey.startsWith('straight_')) {
        const num = parseInt(betKey.split('_')[1], 10);
        if (num === winningNumber) { won = true; payoutMultiplier = 36; }
      } 
      else if (betKey === 'red' && winColor === 'red') { won = true; payoutMultiplier = 2; }
      else if (betKey === 'black' && winColor === 'black') { won = true; payoutMultiplier = 2; }
      else if (betKey === 'even' && isEven) { won = true; payoutMultiplier = 2; }
      else if (betKey === 'odd' && isOdd) { won = true; payoutMultiplier = 2; }
      else if (betKey === 'low' && isLow) { won = true; payoutMultiplier = 2; }
      else if (betKey === 'high' && isHigh) { won = true; payoutMultiplier = 2; }
      else if (betKey === 'dozen_1' && dozen === 1) { won = true; payoutMultiplier = 3; }
      else if (betKey === 'dozen_2' && dozen === 2) { won = true; payoutMultiplier = 3; }
      else if (betKey === 'dozen_3' && dozen === 3) { won = true; payoutMultiplier = 3; }
      else if (betKey === 'col_1' && col === 1) { won = true; payoutMultiplier = 3; }
      else if (betKey === 'col_2' && col === 2) { won = true; payoutMultiplier = 3; }
      else if (betKey === 'col_3' && col === 3) { won = true; payoutMultiplier = 3; }

      if (won) {
        totalWin += stake * payoutMultiplier;
      }
    }

    return totalWin;
  }

  // Exposition globale du moteur
  window.RouletteEngine = {
    getNumberColor,
    calculateWinnings,
    RED_NUMBERS
  };
})();
