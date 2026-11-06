"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./RankEmblem.module.css";
import { motionReduced } from "../theme/appearance";

// The aura spreads this far around the emblem (times its size)
export const AURA_SCALE = 1.9;

const VERTEX = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

// Living light behind the best rank: a swirl of the tier's colors (violet, gold,
// rose) turning slowly, rays sweeping round, sparkles twinkling, all fading out from
// the middle. Premultiplied alpha, so it blends over any page color.
const FRAGMENT = `
precision mediump float;
uniform float t;
uniform vec2 res;

float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 q) {
  vec2 i = floor(q), f = fract(q);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 q) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(q); q = q * 2.03 + 1.7; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / res) * 2.0 - 1.0;
  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // Swirl: noise in polar space, twisted with the distance and turning with time
  vec2 swirl = vec2(cos(a + r * 2.2 - t * 0.35), sin(a + r * 2.2 - t * 0.35)) * (1.2 + r * 1.6);
  float n = fbm(swirl + vec2(t * 0.12, -t * 0.08));

  vec3 violet = vec3(0.48, 0.18, 0.97);
  vec3 gold = vec3(1.0, 0.86, 0.36);
  vec3 rose = vec3(1.0, 0.36, 0.55);
  vec3 col = mix(violet, rose, smoothstep(0.35, 0.65, n));
  col = mix(col, gold, smoothstep(0.58, 0.82, n));

  // Soft body of light, strongest near the emblem
  float body = smoothstep(1.0, 0.25, r) * (0.35 + 0.65 * n);

  // Rays sweeping round
  float rays = pow(abs(sin(a * 6.0 + t * 0.5)), 14.0) + 0.6 * pow(abs(sin(a * 9.0 - t * 0.7)), 22.0);
  rays *= smoothstep(1.0, 0.3, r) * smoothstep(0.15, 0.45, r);

  // Sparkles: a few cells light up in turn
  vec2 cell = floor(uv * 9.0);
  float h = hash(cell);
  vec2 inCell = fract(uv * 9.0) - 0.5;
  float twinkle = pow(max(0.0, sin(t * (1.2 + h * 2.0) + h * 40.0)), 12.0);
  float spark = step(0.86, h) * twinkle * smoothstep(0.18, 0.0, length(inCell)) * smoothstep(1.0, 0.4, r);

  float alpha = clamp(body * 0.8 + rays * 0.55 + spark, 0.0, 1.0);
  vec3 light = col * (body * 0.8 + rays * 0.55) + vec3(1.0, 0.97, 0.85) * spark;
  gl_FragColor = vec4(light, alpha);
}
`;

const compile = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
};

/** Shader aura behind a Morpion Mastermind emblem of this size. Falls back to a CSS
 * glow without WebGL; one still frame when animations are reduced; stops while off
 * screen or in a hidden tab. */
const MastermindAura = ({ size }: { size: number }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  const box = Math.round(size * AURA_SCALE);

  useEffect(() => {
    const el = canvas.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = Math.round(box * dpr);
    el.height = Math.round(box * dpr);
    const gl = el.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) {
      setFallback(true);
      return;
    }
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram()!;
    if (!vs || !fs) {
      setFallback(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setFallback(true);
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const p = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    const uT = gl.getUniformLocation(program, "t");
    gl.uniform2f(gl.getUniformLocation(program, "res"), el.width, el.height);
    gl.viewport(0, 0, el.width, el.height);
    gl.clearColor(0, 0, 0, 0);

    // A different start for each emblem, so two of them never pulse together
    const offset = Math.random() * 100;
    const draw = (now: number) => {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uT, offset + now / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    if (motionReduced()) {
      draw(0);
      return;
    }
    let frame = 0;
    let visible = true;
    const loop = (now: number) => {
      draw(now);
      frame = requestAnimationFrame(loop);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      if (visible && !document.hidden) frame = requestAnimationFrame(loop);
    };
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    seen.observe(el);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
      document.removeEventListener("visibilitychange", update);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [box]);

  return fallback ? (
    <span className={styles.auraFallback} style={{ width: box, height: box }} aria-hidden="true" />
  ) : (
    <canvas ref={canvas} className={styles.aura} style={{ width: box, height: box }} aria-hidden="true" />
  );
};

export default MastermindAura;
