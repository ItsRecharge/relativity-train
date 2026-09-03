// doppler.js — fullscreen relativistic-optics pass for the train view.
// Renders the scene to a target, then applies, per pixel:
//   • relativistic aberration  — the world crowds toward your direction of motion
//   • relativistic Doppler     — blueshift ahead, redshift behind (channel-shift approx)
//   • headlight effect         — intensity beaming ∝ D^k
// The geometry pipeline already shows MEASURED contraction; this pass adds the
// optical layer on top. Honest approximation, not a spectral renderer.
import * as THREE from 'three';

const FRAG = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform float uExposure;
  uniform float beta;
  uniform float uGamma;
  uniform float doAberration;
  uniform float doDoppler;
  uniform float doHeadlight;
  uniform vec3 motionDir;            // world-space direction of travel (unit)
  uniform mat4 projInverse;          // camera.projectionMatrixInverse
  uniform mat4 camWorld;             // camera.matrixWorld
  uniform mat4 viewMatrix2;          // camera.matrixWorldInverse
  uniform mat4 projMatrix;
  varying vec2 vUv;

  vec3 rayDir(vec2 uv) {
    vec4 ndc = vec4(uv * 2.0 - 1.0, 0.5, 1.0);
    vec4 viewP = projInverse * ndc;
    viewP /= viewP.w;
    vec3 world = (camWorld * vec4(viewP.xyz, 0.0)).xyz;
    return normalize(world);
  }

  vec2 dirToUv(vec3 dir) {
    vec4 viewP = viewMatrix2 * vec4(dir, 0.0);
    vec4 clip = projMatrix * vec4(viewP.xyz, 1.0);
    if (clip.w <= 0.0) return vec2(-10.0);
    return clip.xy / clip.w * 0.5 + 0.5;
  }

  vec3 spectralShift(vec3 c, float D) {
    float s = log(D);                       // >0 blue, <0 red
    float t = clamp(abs(s) * 1.6, 0.0, 1.0);
    if (s > 0.0) {
      vec3 shifted = vec3(c.r * 0.22,
                          c.r * 0.72 + c.g * 0.38,
                          c.g * 0.85 + c.b * 0.95);
      c = mix(c, shifted, t);
      // deep blueshift → violet-hot
      c = mix(c, vec3(0.75, 0.78, 1.2) * max(max(c.r, c.g), c.b), clamp((abs(s) - 0.9) * 0.8, 0.0, 0.85));
    } else if (s < 0.0) {
      vec3 shifted = vec3(c.g * 0.85 + c.r * 0.95,
                          c.b * 0.72 + c.g * 0.38,
                          c.b * 0.22);
      c = mix(c, shifted, t);
      // deep redshift → dying embers
      c = mix(c, vec3(0.5, 0.12, 0.05) * max(max(c.r, c.g), c.b), clamp((abs(s) - 0.9) * 0.8, 0.0, 0.9));
    }
    return c;
  }

  void main() {
    vec3 dPrime = rayDir(vUv);              // where this pixel looks (observer frame)
    float cosP = dot(dPrime, motionDir);

    vec2 uv = vUv;
    if (doAberration > 0.5 && beta > 0.0005) {
      // Inverse aberration: which rest-frame direction lands on this pixel?
      float cosT = (cosP - beta) / (1.0 - beta * cosP);
      vec3 perp = dPrime - cosP * motionDir;
      float sinP = length(perp);
      vec3 d;
      if (sinP > 1e-5) {
        float sinT = sqrt(max(0.0, 1.0 - cosT * cosT));
        d = normalize(cosT * motionDir + (sinT / sinP) * perp);
      } else {
        d = motionDir * sign(cosP);
      }
      vec2 srcUv = dirToUv(d);
      if (srcUv.x < -5.0) {
        uv = vUv;                            // behind the camera — keep original
      } else {
        uv = srcUv;
      }
    }

    vec2 cl = clamp(uv, 0.0, 1.0);
    vec3 col = texture2D(tDiffuse, cl).rgb;
    float off = length(uv - cl);
    col *= 1.0 - clamp(off * 6.0, 0.0, 0.92);   // fade where the remap leaves the frame

    if (beta > 0.0005) {
      float D = 1.0 / (uGamma * (1.0 - beta * cosP));
      if (doDoppler > 0.5) col = spectralShift(col, D);
      if (doHeadlight > 0.5) {
        col *= pow(D, 1.9);
        col = col / (1.0 + col * 0.35);          // soft knee so ahead doesn't clip to white
      }
    }

    // Rendering into a target skips three.js tone mapping + sRGB output,
    // so this pass applies both to match the direct-render path.
    col *= uExposure;
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
    col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }
`;

export class RelativisticView {
  constructor(renderer) {
    this.renderer = renderer;
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    this.target = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, {
      samples: 4,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        uExposure: { value: renderer.toneMappingExposure },
        beta: { value: 0 },
        uGamma: { value: 1 },
        doAberration: { value: 1 },
        doDoppler: { value: 1 },
        doHeadlight: { value: 1 },
        motionDir: { value: new THREE.Vector3(1, 0, 0) },
        projInverse: { value: new THREE.Matrix4() },
        camWorld: { value: new THREE.Matrix4() },
        viewMatrix2: { value: new THREE.Matrix4() },
        projMatrix: { value: new THREE.Matrix4() },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  setSize(w, h, pixelRatio) {
    this.target.setSize(w * pixelRatio, h * pixelRatio);
  }

  render(scene, camera, { beta, gamma, aberration, doppler, headlight }) {
    const anyOn = (aberration || doppler || headlight) && beta > 0.0005;
    if (!anyOn) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    const u = this.material.uniforms;
    u.beta.value = beta;
    u.uGamma.value = gamma;
    u.doAberration.value = aberration ? 1 : 0;
    u.doDoppler.value = doppler ? 1 : 0;
    u.doHeadlight.value = headlight ? 1 : 0;
    u.projInverse.value.copy(camera.projectionMatrixInverse);
    u.camWorld.value.copy(camera.matrixWorld);
    u.viewMatrix2.value.copy(camera.matrixWorldInverse);
    u.projMatrix.value.copy(camera.projectionMatrix);

    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCam);
  }
}
