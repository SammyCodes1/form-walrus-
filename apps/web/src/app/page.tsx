"use client";

import React from "react";
import Link from "next/link";
import { ConnectButton } from "@mysten/dapp-kit";

function useBreakpoint() {
  const [isMobile, setIsMobile] = React.useState(false);
  const [isTablet, setIsTablet] = React.useState(false);

  React.useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return { isMobile, isTablet };
}

export default function Home() {
  const [hoveredCard, setHoveredCard] = React.useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { isMobile, isTablet } = useBreakpoint();

  return (
    <div style={{ 
      backgroundColor: "#050510", 
      color: "white", 
      minHeight: "100vh", 
      position: "relative", 
      overflowX: "hidden",
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Inject Global Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes drift1 {
          0% { transform: translate(0,0) scale(1); }
          100% { transform: translate(60px,40px) scale(1.1); }
        }
        @keyframes drift2 {
          0% { transform: translate(0,0) scale(1.1); }
          100% { transform: translate(-40px,60px) scale(1); }
        }
        @keyframes drift3 {
          0% { transform: translate(0,0) scale(1); }
          100% { transform: translate(30px,-50px) scale(1.15); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .drift1 { animation: drift1 12s infinite alternate ease-in-out; }
        .drift2 { animation: drift2 15s infinite alternate ease-in-out; }
        .drift3 { animation: drift3 18s infinite alternate ease-in-out; }
        .drift1-reverse { animation: drift1 10s infinite alternate-reverse ease-in-out; }
        .floating { animation: float 6s ease-in-out infinite; }
      `}} />

      {/* Background System */}
      <div style={{ 
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: "none" 
      }}>
        {/* Aurora Orbs */}
        <div className="drift1" style={{ 
          position: "fixed", zIndex: 0, pointerEvents: "none",
          width: isMobile ? "300px" : "600px", height: isMobile ? "300px" : "600px", top: "-100px", left: "-200px",
          background: "radial-gradient(circle, rgba(99,102,241,0.4), transparent 70%)",
          filter: "blur(80px)"
        }} />
        <div className="drift2" style={{ 
          position: "fixed", zIndex: 0, pointerEvents: "none",
          width: isMobile ? "250px" : "500px", height: isMobile ? "250px" : "500px", top: "200px", right: "-150px",
          background: "radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)",
          filter: "blur(80px)"
        }} />
        <div className="drift3" style={{ 
          position: "fixed", zIndex: 0, pointerEvents: "none",
          width: isMobile ? "350px" : "700px", height: isMobile ? "350px" : "700px", bottom: "-200px", left: "30%",
          background: "radial-gradient(circle, rgba(6,182,212,0.25), transparent 70%)",
          filter: "blur(100px)"
        }} />
        <div className="drift1-reverse" style={{ 
          position: "fixed", zIndex: 0, pointerEvents: "none",
          width: isMobile ? "200px" : "400px", height: isMobile ? "200px" : "400px", top: "50%", right: "20%",
          background: "radial-gradient(circle, rgba(59,130,246,0.3), transparent 70%)",
          filter: "blur(60px)"
        }} />
        
        {/* Dot Grid Overlay */}
        <div style={{ 
          position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: isMobile ? "24px 24px" : "32px 32px"
        }} />
      </div>

      {/* Navbar */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, height: isMobile ? "56px" : "64px", zIndex: 100,
        background: "rgba(5,5,16,0.7)", backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)", padding: isMobile ? "0 16px" : "0 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "24px" }}>🦭</span>
          <span style={{ fontWeight: 800, fontSize: isMobile ? "18px" : "20px", color: "white", letterSpacing: "-0.02em" }}>FormWalrus</span>
        </Link>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {!isMobile && (
            <>
              <ConnectButton />
              <Link href="/dashboard" style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "white", padding: "8px 18px", borderRadius: "10px", fontWeight: 600,
                textDecoration: "none", fontSize: "14px", transition: "all 0.2s"
              }}>Dashboard</Link>
              <Link href="/builder" style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "white", padding: "8px 18px", borderRadius: "10px", fontWeight: 700,
                textDecoration: "none", fontSize: "14px", transition: "all 0.2s",
                boxShadow: "0 0 20px rgba(99,102,241,0.35)"
              }}>Start Building →</Link>
            </>
          )}
          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <ConnectButton />
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={{
                  background: "none", border: "none", color: "white", fontSize: "24px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px"
                }}
              >
                {mobileMenuOpen ? "✕" : "☰"}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobile && mobileMenuOpen && (
          <div style={{
            position: "absolute", top: "56px", left: 0, right: 0, background: "rgba(5,5,16,0.95)",
            backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "20px", display: "flex", flexDirection: "column", gap: "12px", zIndex: 99
          }}>
            <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "white", padding: "12px", borderRadius: "10px", fontWeight: 600,
              textDecoration: "none", fontSize: "16px", textAlign: "center"
            }}>Dashboard</Link>
            <Link href="/builder" onClick={() => setMobileMenuOpen(false)} style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "white", padding: "12px", borderRadius: "10px", fontWeight: 700,
              textDecoration: "none", fontSize: "16px", textAlign: "center"
            }}>Start Building →</Link>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main style={{ position: "relative", zIndex: 2 }}>
        
        {/* Hero Section */}
        <section style={{ 
          paddingTop: isMobile ? "120px" : "160px", 
          paddingLeft: isMobile ? "20px" : "40px",
          paddingRight: isMobile ? "20px" : "40px",
          textAlign: "center" 
        }}>
          <div style={{
            background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: "100px", padding: "6px 16px", fontSize: isMobile ? "12px" : "13px",
            color: "#a78bfa", display: "inline-block", marginBottom: "24px"
          }}>
            ✦ Built on Walrus & Sui
          </div>
          
          <h1 style={{ fontSize: isMobile ? "36px" : "72px", fontWeight: 900, lineHeight: 1.1, margin: 0 }}>
            <div>Forms that live</div>
            <div style={{
              background: "linear-gradient(135deg, #6366f1, #a78bfa, #06b6d4)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
            }}>on the blockchain</div>
          </h1>

          <p style={{ 
            maxWidth: "520px", margin: "24px auto", color: "rgba(255,255,255,0.5)",
            fontSize: isMobile ? "15px" : "18px", lineHeight: 1.6 
          }}>
            Create unstoppable forms. Submissions stored permanently on Walrus.
            Sensitive data encrypted with Seal. No servers. No censorship.
          </p>

          <div style={{ 
            display: "flex", 
            flexDirection: isMobile ? "column" : "row",
            gap: "12px", 
            justifyContent: "center", 
            marginTop: "36px",
            maxWidth: isMobile ? "100%" : "none"
          }}>
            <Link href="/builder" style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              padding: isMobile ? "16px" : "14px 32px", borderRadius: "12px", fontWeight: 700,
              fontSize: "16px", color: "white", border: "none", textDecoration: "none",
              boxShadow: "0 0 40px rgba(99,102,241,0.4)", transition: "all 0.3s",
              textAlign: "center"
            }}>Start Building →</Link>
            
            <Link href="/dashboard" style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
              padding: isMobile ? "16px" : "14px 32px", borderRadius: "12px", fontWeight: 600,
              fontSize: "16px", color: "white", textDecoration: "none", transition: "all 0.3s",
              textAlign: "center"
            }}>View Dashboard</Link>
          </div>
        </section>

        {/* Floating Mock Form Card */}
        <div style={{ marginTop: isMobile ? "48px" : "64px", position: "relative", padding: isMobile ? "0 20px" : "0" }}>
          <div className="floating" style={{
            maxWidth: "560px", margin: "0 auto",
            background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "24px",
            padding: isMobile ? "24px" : "36px", boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div style={{ fontWeight: 700, fontSize: isMobile ? "16px" : "18px" }}>🐛 Bug Report</div>
              <div style={{ 
                background: "rgba(0,212,170,0.1)", color: "#00D4AA", fontSize: "10px", 
                fontWeight: 900, padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(0,212,170,0.2)"
              }}>PUBLIC</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "8px", fontWeight: 700, textTransform: "uppercase" }}>What went wrong?</div>
                <div style={{ 
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", 
                  borderRadius: "10px", padding: "10px 14px", color: "rgba(255,255,255,0.3)", fontSize: "13px"
                }}>The dashboard fails to load on mobile...</div>
              </div>
              
              {!isMobile && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "8px", fontWeight: 700, textTransform: "uppercase" }}>Steps to reproduce</div>
                  <div style={{ 
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", 
                    borderRadius: "10px", padding: "10px 14px", color: "rgba(255,255,255,0.3)", fontSize: "13px"
                  }}>1. Open app 2. Connect wallet...</div>
                </div>
              )}

              <div style={{ display: "flex", gap: "4px", color: "#f59e0b", marginBottom: "24px" }}>
                <span>★</span><span>★</span><span>★</span><span>★</span><span style={{ opacity: 0.2 }}>★</span>
              </div>

              <div style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                borderRadius: "10px", padding: "12px", fontWeight: 700, textAlign: "center",
                fontSize: "14px", cursor: "pointer"
              }}>Submit Report</div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <section style={{ marginTop: isMobile ? "60px" : "80px", padding: isMobile ? "0 20px" : "0" }}>
          <div style={{ 
            display: "flex", 
            flexDirection: isMobile ? "column" : "row",
            maxWidth: "600px", 
            margin: "0 auto", 
            gap: isMobile ? "8px" : "2px" 
          }}>
            {[
              { num: "∞", label: "Permanent Storage", first: true },
              { num: "0", label: "Servers Required" },
              { num: "100%", label: "Decentralized", last: true }
            ].map((stat, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                padding: "24px 32px", textAlign: "center", flex: 1,
                borderRadius: isMobile ? "14px" : 0,
                borderTopLeftRadius: (!isMobile && stat.first) ? "14px" : (isMobile ? "14px" : 0),
                borderBottomLeftRadius: (!isMobile && stat.first) ? "14px" : (isMobile ? "14px" : 0),
                borderTopRightRadius: (!isMobile && stat.last) ? "14px" : (isMobile ? "14px" : 0),
                borderBottomRightRadius: (!isMobile && stat.last) ? "14px" : (isMobile ? "14px" : 0)
              }}>
                <div style={{
                  fontSize: isMobile ? "24px" : "28px", fontWeight: 900, 
                  background: "linear-gradient(135deg, #6366f1, #06b6d4)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
                }}>{stat.num}</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features Grid */}
        <section style={{ marginTop: isMobile ? "80px" : "100px", padding: isMobile ? "0 20px" : "0 40px" }}>
          <div style={{ textAlign: "center", marginBottom: isMobile ? "32px" : "48px" }}>
            <h2 style={{ fontSize: isMobile ? "28px" : "40px", fontWeight: 800, color: "white", marginBottom: "8px" }}>Everything you need</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: isMobile ? "14px" : "16px" }}>Built different. Stored forever.</p>
          </div>

          <div style={{ 
            display: "grid", 
            gridTemplateColumns: isMobile ? "1fr" : (isTablet ? "repeat(2, 1fr)" : "repeat(3, 1fr)"), 
            gap: "16px",
            maxWidth: "1200px", margin: "0 auto"
          }}>
            {[
              { icon: "🗄️", title: "Permanent Storage", desc: "Every submission stored forever on Walrus decentralized storage" },
              { icon: "🔐", title: "Seal Encryption", desc: "Private forms use Seal protocol for end-to-end encryption" },
              { icon: "⛓️", title: "On-Chain Registry", desc: "Every form registered as an object on the Sui blockchain" },
              { icon: "📊", title: "Admin Dashboard", desc: "Sort, filter, prioritize and export submissions with ease" },
              { icon: "🎨", title: "10+ Field Types", desc: "Rich text, dropdowns, star ratings, file uploads and more" },
              { icon: "🔗", title: "Share via Link", desc: "One shareable link — anyone can respond, anywhere" }
            ].map((feature, i) => (
              <div 
                key={i} 
                onMouseEnter={() => !isMobile && setHoveredCard(i)}
                onMouseLeave={() => !isMobile && setHoveredCard(null)}
                style={{
                  background: (!isMobile && hoveredCard === i) ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)", 
                  border: "1px solid",
                  borderColor: (!isMobile && hoveredCard === i) ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.07)",
                  borderRadius: "16px", padding: "28px", transition: "all 0.25s", cursor: "default",
                  boxShadow: (!isMobile && hoveredCard === i) ? "0 0 30px rgba(99,102,241,0.08)" : "none"
                }}
              >
                <div style={{
                  width: "44px", height: "44px", borderRadius: "12px",
                  background: "rgba(99,102,241,0.15)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: "22px", marginBottom: "16px"
                }}>{feature.icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: "16px", marginBottom: "8px" }}>{feature.title}</h3>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer style={{
          marginTop: isMobile ? "80px" : "120px", 
          padding: isMobile ? "32px 20px" : "48px 40px", 
          borderTop: "1px solid rgba(255,255,255,0.06)",
          textAlign: "center"
        }}>
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px", marginBottom: "16px" }}>
            🦭 FormWalrus — Built on Walrus + Sui · 2025
          </div>
          <div style={{ 
            display: "flex", 
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "center", 
            alignItems: "center",
            gap: isMobile ? "12px" : "16px" 
          }}>
            <Link href="/builder" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: "13px", transition: "color 0.2s" }}>Builder</Link>
            {!isMobile && <div style={{ color: "rgba(255,255,255,0.1)" }}>|</div>}
            <Link href="/dashboard" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: "13px", transition: "color 0.2s" }}>Dashboard</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
