import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.ts";
test("pointer lock failure keeps gameplay paused, and retry waits for actual lock", async () => {
  const elements = new Map(
    ["lock-status", "paused"].map((id) => [id, { hidden: true }]),
  );
  const oldDocument = globalThis.document,
    oldWindow = globalThis.window;
  const fakeDocument = {
    pointerLockElement: null as unknown,
    getElementById: (id: string) => elements.get(id),
    body: { classList: { remove() {} } },
    exitPointerLock() {},
  };
  Object.defineProperty(globalThis, "document", {
    value: fakeDocument,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: { setTimeout: () => 0 },
    writable: true,
    configurable: true,
  });
  try {
    const g = Object.create(Game.prototype) as Game;
    g.mode = "menu";
    g.lockPending = false;
    g.lockAttempt = 0;
    g.keys = new Set();
    g.firing = true;
    g.aiming = true;
    g.engineGain = null;
    g.canvas = {
      focus() {},
      requestPointerLock: () => Promise.reject(new Error("permission denied")),
    } as unknown as HTMLCanvasElement;
    g.start();
    assert.equal(g.mode, "menu");
    assert.equal(g.lockPending, true);
    await Promise.resolve();
    assert.equal(g.mode, "paused");
    assert.equal(g.firing, false);
    assert.equal(g.aiming, false);
    assert.equal(elements.get("lock-status")!.hidden, false);
    g.canvas.requestPointerLock = () => Promise.resolve();
    g.start();
    await Promise.resolve();
    assert.equal(g.mode, "paused");
    assert.equal(g.lockPending, true);
    let entered = false;
    g.beginPlaying = () => {
      entered = true;
    };
    fakeDocument.pointerLockElement = g.canvas;
    g.lockPending = false;
    g.start();
    assert.equal(entered, true);
  } finally {
    Object.defineProperty(globalThis, "document", {
      value: oldDocument,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "window", {
      value: oldWindow,
      writable: true,
      configurable: true,
    });
  }
});
test("opening map clears gameplay input and closing still requires successful pointer lock", async () => {
  const oldDocument=globalThis.document,oldWindow=globalThis.window;
  let exited=false,opened=false,closed=false;
  const elements=new Map([['lock-status',{hidden:true}],['paused',{hidden:true}]]);
  const doc={pointerLockElement:{} as unknown,getElementById:(id:string)=>elements.get(id),body:{classList:{remove(){}}},exitPointerLock(){exited=true;this.pointerLockElement=null;}};
  Object.defineProperty(globalThis,'document',{value:doc,writable:true,configurable:true});
  Object.defineProperty(globalThis,'window',{value:{setTimeout:()=>0},writable:true,configurable:true});
  try{
    const g=Object.create(Game.prototype) as Game;g.mode='playing';g.keys=new Set(['KeyW']);g.firing=true;g.aiming=true;g.engineGain=null;
    g.atlas={open(){opened=true;},close(){closed=true;}} as unknown as Game['atlas'];
    g.openMap();assert.equal(g.mode,'map');assert.ok(opened&&exited);assert.equal(g.keys.size,0);assert.equal(g.firing,false);
    g.lockAttempt=0;g.lockPending=false;g.canvas={focus(){},requestPointerLock:()=>Promise.reject(new Error('denied'))} as unknown as HTMLCanvasElement;
    g.start();await Promise.resolve();assert.equal(g.mode,'paused');assert.ok(closed);assert.equal(elements.get('lock-status')!.hidden,false);
  }finally{Object.defineProperty(globalThis,'document',{value:oldDocument,writable:true,configurable:true});Object.defineProperty(globalThis,'window',{value:oldWindow,writable:true,configurable:true});}
});
