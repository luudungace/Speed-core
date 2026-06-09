"use client";

import { useEffect, useRef } from "react";

export function LoginBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const particles: Particle[] = [];
    const dataStreams: DataStream[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    class Particle {
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; color: string;
      pulseSpeed: number; pulsePhase: number;
      constructor(w: number, h: number) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.size = Math.random() * 2.5 + 0.3;
        this.opacity = Math.random() * 0.5 + 0.1;
        const colors = ["#00F0FF", "#6366f1", "#22d3ee", "#1f8ecd"];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.pulseSpeed = Math.random() * 0.02 + 0.005;
        this.pulsePhase = Math.random() * Math.PI * 2;
      }
      update(w: number, h: number, time: number) {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > w) this.vx *= -1;
        if (this.y < 0 || this.y > h) this.vy *= -1;
        this.opacity = (Math.sin(time * this.pulseSpeed + this.pulsePhase) + 1) / 2 * 0.45 + 0.08;
      }
      draw(c: CanvasRenderingContext2D) {
        c.beginPath();
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        c.fillStyle = this.color;
        c.globalAlpha = this.opacity;
        c.fill();
        
        // Twinkling cross flare for brighter star particles
        if (this.size > 1.8) {
          c.strokeStyle = this.color;
          c.globalAlpha = this.opacity * 0.45;
          c.lineWidth = 0.55;
          
          c.beginPath();
          c.moveTo(this.x - this.size * 3.5, this.y);
          c.lineTo(this.x + this.size * 3.5, this.y);
          c.stroke();
          
          c.beginPath();
          c.moveTo(this.x, this.y - this.size * 3.5);
          c.lineTo(this.x, this.y + this.size * 3.5);
          c.stroke();
        }
        
        // Glow aura
        if (this.size > 1.5) {
          c.beginPath();
          c.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
          c.fillStyle = this.color;
          c.globalAlpha = this.opacity * 0.12;
          c.fill();
        }
        c.globalAlpha = 1;
      }
    }

    // Data stream particles (vertical rising lines)
    class DataStream {
      x: number; y: number; speed: number; length: number;
      opacity: number; delay: number; active: boolean;
      constructor(w: number, h: number) {
        this.x = Math.random() * w;
        this.y = h + Math.random() * 200;
        this.speed = Math.random() * 1.5 + 0.5;
        this.length = Math.random() * 60 + 20;
        this.opacity = Math.random() * 0.15 + 0.05;
        this.delay = Math.random() * 200;
        this.active = false;
      }
      update(h: number, time: number) {
        if (time > this.delay) this.active = true;
        if (!this.active) return;
        this.y -= this.speed;
        if (this.y + this.length < 0) {
          this.y = h + 50;
          this.delay = time + Math.random() * 300;
          this.active = false;
        }
      }
      draw(c: CanvasRenderingContext2D) {
        if (!this.active) return;
        const gradient = c.createLinearGradient(this.x, this.y, this.x, this.y + this.length);
        gradient.addColorStop(0, `rgba(0,240,255,${this.opacity})`);
        gradient.addColorStop(1, "rgba(0,240,255,0)");
        c.beginPath();
        c.moveTo(this.x, this.y);
        c.lineTo(this.x, this.y + this.length);
        c.strokeStyle = gradient;
        c.lineWidth = 1;
        c.stroke();
      }
    }

    const numParticles = Math.min(120, Math.floor((canvas.width * canvas.height) / 10000));
    for (let i = 0; i < numParticles; i++) particles.push(new Particle(canvas.width, canvas.height));
    for (let i = 0; i < 25; i++) dataStreams.push(new DataStream(canvas.width, canvas.height));

    let time = 0;
    const animate = () => {
      time++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections (neural network effect)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = "#00F0FF";
            ctx.globalAlpha = (1 - dist / 140) * 0.1;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }

      // Particles
      particles.forEach((p) => { p.update(canvas.width, canvas.height, time); p.draw(ctx); });
      // Data streams
      dataStreams.forEach((d) => { d.update(canvas.height, time); d.draw(ctx); });

      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(animId); };
  }, []);

  return (
    <>
      {/* Deep space gradient base */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 1400px 900px at 25% 45%, rgba(26,72,148,.18), transparent 70%),
            radial-gradient(ellipse 1000px 700px at 75% 55%, rgba(99,102,241,.1), transparent 60%),
            radial-gradient(ellipse 800px 500px at 50% 100%, rgba(0,240,255,.08), transparent 50%),
            radial-gradient(ellipse 600px 300px at 50% 0%, rgba(26,72,148,.08), transparent 60%),
            linear-gradient(180deg, #010306 0%, #040810 30%, #030610 70%, #010306 100%)
          `,
        }}
      />

      {/* Particle + data stream canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0"
        style={{ opacity: 0.7 }}
      />

      {/* Perspective grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,240,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,240,255,.025) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
          maskImage: "radial-gradient(ellipse at 50% 60%, #000 15%, transparent 70%)",
        }}
      />

      {/* ===== CYBERNETIC NEXUS BEAM (Center) ===== */}
      <div className="pointer-events-none fixed inset-0 z-[1] flex items-end justify-center overflow-hidden">
        {/* 3D Perspective Grid Floor */}
        <div
          className="absolute bottom-0 left-0 w-full"
          style={{
            height: "40vh",
            backgroundImage: `
              linear-gradient(rgba(0,240,255,.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,240,255,.15) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
            backgroundPosition: "center bottom",
            transform: "perspective(250px) rotateX(75deg)",
            transformOrigin: "bottom center",
            maskImage: "linear-gradient(to top, rgba(0,0,0,1) 5%, rgba(0,0,0,0) 80%)",
            WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,1) 5%, rgba(0,0,0,0) 80%)",
          }}
        />

        {/* Main Beam – Wide outer glow */}
        <div
          className="absolute left-1/2 bottom-0 login-beam-breathe"
          style={{
            width: "100px",
            height: "105vh",
            transform: "translateX(-50%)",
            background: `linear-gradient(
              to bottom,
              transparent 0%,
              rgba(0,240,255,.01) 10%,
              rgba(0,240,255,.04) 25%,
              rgba(0,240,255,.12) 45%,
              rgba(0,240,255,.35) 65%,
              rgba(255,255,255,.7) 85%,
              rgba(0,240,255,.95) 95%,
              rgba(0,240,255,1) 100%
            )`,
            filter: "blur(16px)",
            boxShadow: "0 0 60px rgba(0,240,255,.35), 0 0 150px rgba(0,240,255,.12)",
          }}
        />

        {/* Core Beam – Bright center line */}
        <div
          className="absolute left-1/2 bottom-0"
          style={{
            width: "14px",
            height: "105vh",
            transform: "translateX(-50%)",
            background: `linear-gradient(
              to bottom,
              transparent 0%,
              rgba(255,255,255,.01) 10%,
              rgba(255,255,255,.1) 30%,
              rgba(255,255,255,.4) 50%,
              rgba(255,255,255,.75) 70%,
              rgba(255,255,255,.95) 88%,
              rgba(255,255,255,1) 100%
            )`,
            filter: "blur(2px)",
            boxShadow: "0 0 20px #fff, 0 0 50px rgba(0,240,255,.6)",
          }}
        />

        {/* Beam impact splash at base */}
        <div
          className="absolute left-1/2 bottom-0 login-beam-breathe"
          style={{
            width: "500px",
            height: "60px",
            transform: "translateX(-50%)",
            background: "radial-gradient(ellipse at 50% 100%, rgba(0,240,255,.45) 0%, rgba(0,240,255,.12) 40%, transparent 70%)",
            filter: "blur(6px)",
          }}
        />

        {/* Rising energy particles along beam */}
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[4px] h-[105vh]">
          <div className="login-beam-particle-1 absolute w-[3px] h-[3px] rounded-full bg-white shadow-[0_0_6px_#fff,0_0_12px_#00F0FF]" />
          <div className="login-beam-particle-2 absolute w-[2px] h-[2px] rounded-full bg-[#00F0FF] shadow-[0_0_4px_#00F0FF,0_0_8px_#00F0FF]" />
          <div className="login-beam-particle-3 absolute w-[2px] h-[2px] rounded-full bg-white shadow-[0_0_5px_#fff,0_0_10px_#00F0FF]" />
        </div>
      </div>

      {/* Ambient floating orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute -top-[200px] -left-[200px] w-[700px] h-[700px] rounded-full login-orb-float"
          style={{
            background: "radial-gradient(circle, rgba(26,72,148,.2) 0%, transparent 65%)",
            filter: "blur(80px)",
            animationDuration: "22s",
          }}
        />
        <div
          className="absolute -bottom-[200px] -right-[200px] w-[600px] h-[600px] rounded-full login-orb-float"
          style={{
            background: "radial-gradient(circle, rgba(99,102,241,.18) 0%, transparent 65%)",
            filter: "blur(80px)",
            animationDuration: "28s",
            animationDelay: "-10s",
          }}
        />
        <div
          className="absolute top-[20%] right-[10%] w-[300px] h-[300px] rounded-full login-orb-float"
          style={{
            background: "radial-gradient(circle, rgba(0,240,255,.06) 0%, transparent 70%)",
            filter: "blur(60px)",
            animationDuration: "18s",
            animationDelay: "-5s",
          }}
        />
        <div
          className="absolute bottom-[30%] left-[15%] w-[250px] h-[250px] rounded-full login-orb-float"
          style={{
            background: "radial-gradient(circle, rgba(31,142,205,.08) 0%, transparent 70%)",
            filter: "blur(50px)",
            animationDuration: "15s",
            animationDelay: "-3s",
          }}
        />
      </div>

      {/* Floating telemetry tags */}
      <FloatTag className="left-[3%] top-[8%]" dotColor="#00F0FF" delay="0s">
        DA 72 · forum.example.com
      </FloatTag>
      <FloatTag className="right-[3%] top-[4%]" dotColor="#22d3ee" delay="-2s">
        backlink_posted · 200 OK
      </FloatTag>
      <FloatTag className="bottom-[8%] left-[3%]" dotColor="#6366f1" delay="-4s">
        crawl_jobs · 1,284 urls
      </FloatTag>
      <FloatTag className="bottom-[4%] right-[3%]" dotColor="#f59e0b" delay="-6s">
        queue · 42 running
      </FloatTag>
      <FloatTag className="left-[4%] top-[24%] max-lg:hidden" dotColor="#00F0FF" delay="-3s">
        dofollow · +318
      </FloatTag>
      <FloatTag className="right-[4%] top-[12%] max-lg:hidden" dotColor="#22d3ee" delay="-5s">
        phpBB · registered
      </FloatTag>

      {/* Horizontal scan lines */}
      <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
        <div
          className="absolute left-0 w-full h-[1px] login-scanline"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(0,240,255,.12) 20%, rgba(0,240,255,.25) 50%, rgba(0,240,255,.12) 80%, transparent)",
            boxShadow: "0 0 20px rgba(0,240,255,.08), 0 0 60px rgba(0,240,255,.03)",
          }}
        />
        <div
          className="absolute left-0 w-full h-[1px] login-scanline-2"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(99,102,241,.08) 30%, rgba(99,102,241,.15) 50%, rgba(99,102,241,.08) 70%, transparent)",
            boxShadow: "0 0 15px rgba(99,102,241,.05)",
          }}
        />
      </div>

      {/* Corner accents */}
      <div className="pointer-events-none fixed top-0 left-0 z-[1] w-[150px] h-[150px]">
        <div className="absolute top-6 left-6 w-[40px] h-[1px] bg-gradient-to-r from-[#00F0FF]/30 to-transparent" />
        <div className="absolute top-6 left-6 w-[1px] h-[40px] bg-gradient-to-b from-[#00F0FF]/30 to-transparent" />
      </div>
      <div className="pointer-events-none fixed bottom-0 right-0 z-[1] w-[150px] h-[150px]">
        <div className="absolute bottom-6 right-6 w-[40px] h-[1px] bg-gradient-to-l from-[#00F0FF]/20 to-transparent" />
        <div className="absolute bottom-6 right-6 w-[1px] h-[40px] bg-gradient-to-t from-[#00F0FF]/20 to-transparent" />
      </div>
    </>
  );
}

function FloatTag({
  children,
  className,
  dotColor,
  delay,
}: {
  children: React.ReactNode;
  className?: string;
  dotColor: string;
  delay: string;
}) {
  return (
    <div
      className={`login-float-tag absolute z-[1] hidden rounded-lg border border-white/[0.06] bg-[#0a0f1c]/70 px-3 py-2 font-mono text-[10px] font-bold text-slate-400 backdrop-blur-md md:block ${className ?? ""}`}
      style={{ animationDelay: delay }}
    >
      <span
        className="mr-2 inline-block size-[6px] rounded-full align-middle"
        style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
      />
      {children}
    </div>
  );
}
