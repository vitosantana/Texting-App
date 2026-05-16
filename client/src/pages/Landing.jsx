import { Link } from 'react-router-dom';
import './Landing.css';

function Landing() {
    return (
        <div className="landing-page">
            <div className="animated-bg">
                <span className="glow glow-1"></span>
                <span className="glow glow-2"></span>
                <span className="glow glow-3"></span>
                <span className="glow glow-4"></span>
                 <span className="star star-1">
                    <span></span>
                    <span className="core"></span>
                 </span>
                  <span className="star star-2">
                  <span></span>
                    <span className="core"></span>
                    </span>
                   <span className="star star-3">
                    <span></span>
                    <span className="core"></span>
                    </span>
                    <span className="star star-4">
                        <span></span>
                        <span className="core"></span>
                        </span>
                     <span className="star star-5">
                        <span></span>
                        <span className="core"></span>
                        </span>
            </div>

            <header className="landing-navbar">
                <div className="brand">TextingApp</div>
                <Link to="/Landing"></Link>
                

                <nav className="landing-nav">
                    <Link to="/login" className="login-nav-btn">
                    Log In
                    </Link>
                </nav>
            </header>

            <main className="hero-section simple-hero">
                <div className="hero-content">
                    <h1>
                      CHAT THAT'S
                      <br />
                      CLEAN, FAST
                      <br />
                      & MODERN  
                    </h1>

                    <p>
                     A clean, fast messaging experience built for direct conversations, smooth interaction, and a focused interface. 
                    </p>

                    <Link to="/register" className="hero-register-btn">
                    Register
                    </Link>
                </div>

            </main>
        </div>
    );
}

export default Landing;