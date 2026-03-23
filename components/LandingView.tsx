import React, { useRef, useLayoutEffect, useState, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRightIcon, CameraIcon, ChartBarIcon, ShieldCheckIcon } from './Icons';

gsap.registerPlugin(ScrollTrigger);

const DASHBOARD_SCREENSHOTS = [
  '/dashboard_home.png',
  '/dashboard_inventory.png',
  '/dashboard_reports.png',
];

interface LandingViewProps {
  onEnter: () => void;
}

const LandingView: React.FC<LandingViewProps> = ({ onEnter }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentScreenshot, setCurrentScreenshot] = useState(Math.floor(Math.random() * 3));

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentScreenshot(prev => (prev + 1) % DASHBOARD_SCREENSHOTS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // Navbar entrance
      tl.from('.nav-element', {
        y: -50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out'
      });

      // Hero text entrance
      tl.from('.hero-text', {
        y: 50,
        opacity: 0,
        duration: 1,
        stagger: 0.2,
        ease: 'power3.out'
      }, '-=0.4');

      // Image / Mockup entrance
      tl.from('.hero-mockup', {
        y: 100,
        scale: 0.95,
        opacity: 0,
        duration: 1.2,
        ease: 'power3.out'
      }, '-=0.6');

      // ScrollTrigger for Bento Grid
      gsap.from('.bento-item', {
        scrollTrigger: {
          trigger: '.bento-grid',
          start: 'top 80%',
        },
        y: 50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out'
      });

    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#050510] text-gray-200 overflow-x-hidden selection:bg-sena-green selection:text-white font-sans">
      {/* Background Gradients */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-sena-green/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Navbar */}
      <nav className="fixed w-full z-50 top-0 transition-all backdrop-blur-md bg-[#050510]/60 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="nav-element flex items-center gap-4">
            <img src="/logoSena.png" onError={(e) => e.currentTarget.src = "https://www.sena.edu.co/Style%20Library/alayout/images/logoSena.png"} alt="SENA" className="h-10 w-10 drop-shadow-[0_0_10px_rgba(57,169,0,0.5)]" />
            <span className="text-xl font-bold tracking-tight text-white">Gestor de Préstamos <span className="text-sena-green">MediaLab</span></span>
          </div>
          <div className="nav-element">
            <button
              onClick={onEnter}
              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-sena-green/50 text-white text-sm font-semibold rounded-full transition-all flex items-center gap-2 group"
            >
              Ingresar <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 min-h-[90vh] flex flex-col items-center justify-center text-center">
        <div className="max-w-4xl mx-auto z-10">
          <div className="hero-text inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sena-green/10 border border-sena-green/20 text-sena-green font-mono text-[10px] sm:text-xs mb-8 tracking-widest text-center leading-relaxed">
            <span className="w-2 h-2 rounded-full bg-sena-green animate-pulse flex-shrink-0"></span>
            Centro de la Industria, la Empresa y los Servicios — CIES
          </div>
          <h1 className="hero-text text-5xl md:text-7xl font-extrabold text-white tracking-tighter mb-6 leading-tight">
            Instrumento de <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sena-green to-emerald-400">
              Precisión Digital
            </span>
          </h1>
          <p className="hero-text text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
            Gestión inmersiva, auditoría en tiempo real y sincronización PWA offline para el control absoluto del inventario audiovisual.
          </p>
          <div className="hero-text flex justify-center">
            <button
              onClick={onEnter}
              className="px-8 py-4 bg-sena-green text-white font-bold rounded-xl shadow-[0_0_20px_rgba(57,169,0,0.4)] hover:shadow-[0_0_30px_rgba(57,169,0,0.6)] hover:scale-105 transition-all text-lg flex items-center gap-3"
            >
              Iniciar Gestión del Préstamo <ArrowRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hero Dashboard Screenshots */}
        <div className="hero-mockup mt-20 w-full max-w-5xl mx-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sena-green to-transparent opacity-50"></div>
          <div className="flex gap-2 mb-4 px-2">
            <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
          </div>
          <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden bg-black/40">
            {DASHBOARD_SCREENSHOTS.map((src, idx) => (
              <img
                key={src}
                src={src}
                alt={`Vista del Dashboard ${idx + 1}`}
                className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-1000 ${
                  idx === currentScreenshot ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}
            {/* Navigation dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {DASHBOARD_SCREENSHOTS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentScreenshot(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentScreenshot
                      ? 'bg-sena-green w-6 shadow-[0_0_6px_rgba(57,169,0,0.6)]'
                      : 'bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="mb-16 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">Arquitectura del Sistema</h2>
        </div>
        <div className="bento-grid grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[280px]">

          {/* Card 1 */}
          <div className="bento-item md:col-span-2 bg-gradient-to-br from-white/10 to-transparent border border-white/10 p-8 rounded-3xl flex flex-col justify-end relative overflow-hidden group">
            <div className="absolute top-8 right-8 text-sena-green/50 group-hover:text-sena-green transition-colors">
              <ChartBarIcon className="w-16 h-16" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2 relative z-10">Analítica Avanzada</h3>
            <p className="text-gray-400 font-light max-w-md relative z-10">Inteligencia de negocio en tiempo real. Visualiza cuellos de botella mediante Recharts y reportes IA integrados.</p>
          </div>

          {/* Card 2 */}
          <div className="bento-item md:col-span-1 bg-white/5 border border-white/10 p-8 rounded-3xl flex flex-col justify-end relative overflow-hidden group hover:bg-white/10 transition-colors">
            <div className="absolute top-8 right-8 text-blue-400/50 group-hover:text-blue-400 transition-colors">
              <ShieldCheckIcon className="w-16 h-16" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2 z-10">Auditoría Super Admin</h3>
            <p className="text-gray-400 font-light text-sm z-10">Control absoluto. Trazabilidad de borrado e histórico inmutable en Firestore.</p>
          </div>

          {/* Card 3 */}
          <div className="bento-item md:col-span-1 bg-white/5 border border-white/10 p-8 rounded-3xl flex flex-col justify-end relative overflow-hidden group hover:bg-white/10 transition-colors">
            <div className="absolute top-8 right-8 text-purple-400/50 group-hover:text-purple-400 transition-colors">
              <CameraIcon className="w-16 h-16" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2 z-10">Evidencia Visual</h3>
            <p className="text-gray-400 font-light text-sm z-10">Capturas fotográficas al retornar equipos para garantías de calidad al instante.</p>
          </div>

          {/* Card 4 */}
          <div className="bento-item md:col-span-2 bg-gradient-to-bl from-sena-green/10 via-black/20 to-black/40 border border-white/10 p-8 rounded-3xl flex flex-col justify-end relative overflow-hidden group">
            <div className="absolute right-0 bottom-0 w-64 h-64 bg-sena-green/10 rounded-full blur-[80px] group-hover:bg-sena-green/20 transition-all"></div>
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-6 z-10 border border-white/20">
              <div className="w-3 h-3 bg-sena-green rounded-full shadow-[0_0_10px_#39A900]"></div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2 z-10">Sincronización PWA</h3>
            <p className="text-gray-400 font-light max-w-md z-10">Funcionamiento ininterrumpido. El Service Worker gestiona el cache para operar en bodegas sin Wi-Fi.</p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#020205] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <img src="/logoSena.png" onError={(e) => e.currentTarget.src = "https://www.sena.edu.co/Style%20Library/alayout/images/logoSena.png"} alt="SENA" className="h-8 w-8 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all" />
            <span className="text-gray-500 font-bold text-sm tracking-widest">SENA CIES</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-sena-green animate-pulse"></div>
            <span className="text-xs text-gray-500 uppercase tracking-widest font-mono">All systems operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingView;
