export type JoystickVector = { x: number; y: number; magnitude: number };

export function normalizeJoystick(
  dx: number,
  dy: number,
  radius: number,
  deadZone = 0.12,
): JoystickVector {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || radius <= 0) {
    return { x: 0, y: 0, magnitude: 0 };
  }
  const distance = Math.hypot(dx, dy);
  const rawMagnitude = Math.min(1, distance / radius);
  if (rawMagnitude <= deadZone || distance === 0) {
    return { x: 0, y: 0, magnitude: 0 };
  }
  const magnitude = (rawMagnitude - deadZone) / (1 - deadZone);
  return {
    x: (dx / distance) * magnitude,
    y: (dy / distance) * magnitude,
    magnitude,
  };
}

export function hasTouchControls(
  win: Pick<Window, "matchMedia"> = window,
  nav: Pick<Navigator, "maxTouchPoints"> = navigator,
) {
  return nav.maxTouchPoints > 0 && win.matchMedia("(pointer: coarse)").matches;
}

export type MobileContextAction =
  | "shop"
  | "helicopter"
  | "takeover"
  | "enter"
  | "exit-car"
  | "exit-helicopter"
  | null;

export type MobileControlsView = {
  visible: boolean;
  locomotion: "walking" | "driving" | "flying";
  contextAction: MobileContextAction;
};

type MobileControlsOptions = {
  canvas: HTMLCanvasElement;
  onLook: (dx: number, dy: number) => void;
  onContext: () => void;
  onPrimaryPress: () => void;
  onSecondaryPress: () => void;
  onFireChange: (active: boolean) => void;
};

const contextLabels: Record<Exclude<MobileContextAction, null>, string> = {
  shop: "商店",
  helicopter: "驾驶",
  takeover: "抢车",
  enter: "上车",
  "exit-car": "下车",
  "exit-helicopter": "离机",
};

/** Touch gesture ownership only. Gameplay decisions stay in Game. */
export class MobileControls {
  readonly enabled: boolean;
  private root: HTMLElement;
  private joystick: HTMLElement;
  private joystickKnob: HTMLElement;
  private contextButton: HTMLButtonElement;
  private fireButton: HTMLButtonElement;
  private primaryButton: HTMLButtonElement;
  private secondaryButton: HTMLButtonElement;
  private joystickPointer: number | null = null;
  private lookPointer: number | null = null;
  private lookX = 0;
  private lookY = 0;
  private active = false;
  private holdResets: Array<() => void> = [];
  private vector: JoystickVector = { x: 0, y: 0, magnitude: 0 };
  primaryHeld = false;
  secondaryHeld = false;

  constructor(private options: MobileControlsOptions) {
    this.enabled = hasTouchControls();
    this.root = document.getElementById("mobile-controls")!;
    this.joystick = document.getElementById("mobile-joystick")!;
    this.joystickKnob = document.getElementById("mobile-joystick-knob")!;
    this.contextButton = document.getElementById("mobile-context") as HTMLButtonElement;
    this.fireButton = document.getElementById("mobile-fire") as HTMLButtonElement;
    this.primaryButton = document.getElementById("mobile-primary") as HTMLButtonElement;
    this.secondaryButton = document.getElementById("mobile-secondary") as HTMLButtonElement;
    document.body.classList.toggle("touch-device", this.enabled);
    this.root.hidden = true;
    if (this.enabled) this.bind();
  }

  get movement() {
    return this.vector;
  }

  get looking() {
    return this.lookPointer !== null;
  }

  render(view: MobileControlsView) {
    this.active = this.enabled && view.visible;
    this.root.hidden = !this.active;
    if (!this.active) {
      this.clear();
      return;
    }

    if (this.root.dataset.locomotion && this.root.dataset.locomotion !== view.locomotion) this.clear();
    this.root.dataset.locomotion = view.locomotion;
    this.contextButton.hidden = view.contextAction === null;
    if (view.contextAction) this.contextButton.textContent = contextLabels[view.contextAction];

    const walking = view.locomotion === "walking";
    const flying = view.locomotion === "flying";
    this.fireButton.hidden = !walking;
    this.primaryButton.textContent = walking ? "跳跃" : flying ? "上升" : "手刹";
    this.secondaryButton.hidden = view.locomotion === "driving";
    this.secondaryButton.textContent = flying ? "下降" : "换弹";
  }

  hide() {
    this.active = false;
    this.root.hidden = true;
    this.clear();
  }

  clear() {
    // Disabled touch controls must never cancel desktop mouse input during HUD refresh.
    if (!this.enabled) return;
    for (const reset of this.holdResets) reset();
    this.vector = { x: 0, y: 0, magnitude: 0 };
    const joystickPointer = this.joystickPointer;
    const lookPointer = this.lookPointer;
    this.joystickPointer = null;
    this.lookPointer = null;
    if (joystickPointer !== null && this.joystick.hasPointerCapture(joystickPointer)) this.joystick.releasePointerCapture(joystickPointer);
    if (lookPointer !== null && this.options.canvas.hasPointerCapture(lookPointer)) this.options.canvas.releasePointerCapture(lookPointer);
    this.primaryHeld = false;
    this.secondaryHeld = false;
    this.joystickKnob.style.transform = "translate3d(0, 0, 0)";
    this.fireButton.classList.remove("pressed");
    this.primaryButton.classList.remove("pressed");
    this.secondaryButton.classList.remove("pressed");
    this.options.onFireChange(false);
  }

  private bind() {
    // iOS callout and text selection are independent of touch-action.
    document.addEventListener("contextmenu", event => {
      if (this.active) event.preventDefault();
    });
    document.addEventListener("selectstart", event => {
      if (this.active) event.preventDefault();
    });
    const updateJoystick = (event: PointerEvent) => {
      if (event.pointerId !== this.joystickPointer) return;
      const rect = this.joystick.getBoundingClientRect();
      const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.32);
      this.vector = normalizeJoystick(
        event.clientX - (rect.left + rect.width / 2),
        event.clientY - (rect.top + rect.height / 2),
        radius,
      );
      this.joystickKnob.style.transform = `translate3d(${this.vector.x * radius}px, ${this.vector.y * radius}px, 0)`;
    };
    const releaseJoystick = (event: PointerEvent) => {
      if (event.pointerId !== this.joystickPointer) return;
      this.joystickPointer = null;
      this.vector = { x: 0, y: 0, magnitude: 0 };
      this.joystickKnob.style.transform = "translate3d(0, 0, 0)";
    };
    this.joystick.addEventListener("pointerdown", (event) => {
      if (!this.active || this.joystickPointer !== null) return;
      event.preventDefault();
      this.joystickPointer = event.pointerId;
      this.joystick.setPointerCapture(event.pointerId);
      updateJoystick(event);
    });
    this.joystick.addEventListener("pointermove", updateJoystick);
    this.joystick.addEventListener("pointerup", releaseJoystick);
    this.joystick.addEventListener("pointercancel", releaseJoystick);
    this.joystick.addEventListener("lostpointercapture", releaseJoystick);

    this.options.canvas.addEventListener("pointerdown", (event) => {
      if (!this.active || event.pointerType === "mouse" || this.lookPointer !== null) return;
      event.preventDefault();
      this.lookPointer = event.pointerId;
      this.lookX = event.clientX;
      this.lookY = event.clientY;
      this.options.canvas.setPointerCapture(event.pointerId);
    });
    this.options.canvas.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.lookPointer) return;
      event.preventDefault();
      const dx = Math.max(-80, Math.min(80, event.clientX - this.lookX));
      const dy = Math.max(-80, Math.min(80, event.clientY - this.lookY));
      this.lookX = event.clientX;
      this.lookY = event.clientY;
      this.options.onLook(dx, dy);
    });
    const releaseLook = (event: PointerEvent) => {
      if (event.pointerId === this.lookPointer) this.lookPointer = null;
    };
    this.options.canvas.addEventListener("pointerup", releaseLook);
    this.options.canvas.addEventListener("pointercancel", releaseLook);
    this.options.canvas.addEventListener("lostpointercapture", releaseLook);

    this.contextButton.addEventListener("click", (event) => {
      event.preventDefault();
      if (this.active) this.options.onContext();
    });
    this.bindHold(this.fireButton, (pressed) => this.options.onFireChange(pressed), true);
    this.bindHold(this.primaryButton, (pressed) => {
      this.primaryHeld = pressed;
      if (pressed) this.options.onPrimaryPress();
    });
    this.bindHold(this.secondaryButton, (pressed) => {
      this.secondaryHeld = pressed;
      if (pressed) this.options.onSecondaryPress();
    });
  }

  private bindHold(button: HTMLButtonElement, onChange: (pressed: boolean) => void, dragToLook = false) {
    let pointer: number | null = null;
    let x = 0;
    let y = 0;
    const reset = () => {
      const previous = pointer;
      pointer = null;
      if (previous !== null && button.hasPointerCapture(previous)) button.releasePointerCapture(previous);
      button.classList.remove("pressed");
      if (previous !== null) onChange(false);
    };
    this.holdResets.push(reset);
    const release = (event: PointerEvent) => {
      if (event.pointerId === pointer) reset();
    };
    button.addEventListener("pointerdown", (event) => {
      if (!this.active || button.hidden || pointer !== null) return;
      event.preventDefault();
      pointer = event.pointerId;
      x = event.clientX;
      y = event.clientY;
      button.setPointerCapture(event.pointerId);
      button.classList.add("pressed");
      onChange(true);
    });
    button.addEventListener("pointermove", (event) => {
      if (!dragToLook || !this.active || event.pointerId !== pointer) return;
      event.preventDefault();
      this.options.onLook(Math.max(-80, Math.min(80, event.clientX - x)), Math.max(-80, Math.min(80, event.clientY - y)));
      x = event.clientX;
      y = event.clientY;
    });
    button.addEventListener("contextmenu", event => event.preventDefault());
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  }
}
