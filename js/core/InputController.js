/**
 * Clavier du combat :
 *  - déplacement 4 directions (flèches, WASD ou ZQSD) => axes vertical/horizontal
 *  - touches 1..9 => toggle du module correspondant (via callback onNumberKey)
 */
export class InputController {
  constructor(onNumberKey, onEmp, onCycleStation) {
    this.onNumberKey = onNumberKey;
    this.onEmp = onEmp;
    this.onCycleStation = onCycleStation;
    this.up = this.down = this.left = this.right = false;
    this.missileFiring = false; // Espace maintenu => tir des missiles
    this.enabled = false;
    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  disable() {
    this.enabled = false;
    this.up = this.down = this.left = this.right = false;
    this.missileFiring = false;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  // Pilotage type navire : poussée (avant/arrière) + virage (gauche/droite).
  get thrust() { return (this.up ? 1 : 0) + (this.down ? -1 : 0); }         // +avance / -recule
  get turn() { return (this.left ? 1 : 0) + (this.right ? -1 : 0); }        // +gauche(CCW) / -droite(CW)

  _key(e, isDown) {
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': case 'KeyZ': this.up = isDown; break;      // WASD + ZQSD
      case 'ArrowDown': case 'KeyS': this.down = isDown; break;
      case 'ArrowLeft': case 'KeyA': case 'KeyQ': this.left = isDown; break;
      case 'ArrowRight': case 'KeyD': this.right = isDown; break;
      case 'Space': this.missileFiring = isDown; e.preventDefault(); break;   // missiles
      case 'KeyE': if (isDown) this.onEmp?.(); break;                          // IEM
      case 'Tab': e.preventDefault(); if (isDown) this.onCycleStation?.(); break; // poste suivant
      default:
        if (isDown && /^Digit[1-9]$/.test(e.code)) this.onNumberKey?.(parseInt(e.code.slice(5), 10));
    }
  }
}
