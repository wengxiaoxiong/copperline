// Developer-only: measure GPU rendering at the current camera without advancing gameplay.
// This does not measure input latency, simulation time or sustained gameplay FPS.
export async function renderProfile(game) {
  const gl = game.renderer.getContext();
  const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!extension) throw new Error('GPU timer queries are unavailable');
  const samples = [];
  game.city.updateLighting(game.camera.position);
  for (let i = 0; i < 3; i++) {
    const query = gl.createQuery();
    try {
      gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
      game.renderer.render(game.scene, game.camera);
      gl.endQuery(extension.TIME_ELAPSED_EXT);
      const deadline = performance.now() + 5000;
      while (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
        if (gl.isContextLost() || performance.now() > deadline) throw new Error('GPU query timed out');
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      if (gl.getParameter(extension.GPU_DISJOINT_EXT)) throw new Error('GPU timing was invalidated');
      samples.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
    } finally {
      gl.deleteQuery(query);
    }
  }
  let pointLights = 0;
  game.scene.traverse(object => { if (object.isPointLight) pointLights++; });
  return { gpuMs: samples, pointLights, drawCalls: game.renderer.info.render.calls,
    below50ms: samples.every(ms => ms < 50) };
}
