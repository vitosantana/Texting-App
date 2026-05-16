import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../api/auth';
import './Login.css';

function Login() {
    const [form, setForm] = useState({ username: '', password: '' });
    const navigate = useNavigate();

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const { data } = await loginUser(form);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            navigate('/home');
        } catch (error) {
            console.log(error.response?.data);
            alert(error.response?.data?.message ||'Login failed');
        }
        }

    return (
        <div className="login-page">
            <div className="login-bg glow login-bg-glow-1"></div>
            <div className="login-bg glow login-bg-glow-2"></div>
            <div className="login-bg glow login-bg-glow-3"></div>

            <header className="login-topbar">
               <Link to="/" className="login-brand">
    Texting APP
  </Link>
            </header>

            <main className="login-center">
                <div className="login-card">
                    <div className="login-panel">
                        <h1>Welcome back!</h1>
                        <p className="login-subtext">We're are so exicited to see you again!</p>

                        <form onSubmit={handleSubmit} className="login-form">
                            <label htmlFor="username">Username</label>
                            <input 
                            id="username"
                            name="username"
                            type="text"
                            value={form.username}
                            onChange={handleChange}
                            placeholder="Enter your username"
                            required
                            />

                            <label htmlFor="password">Password</label>
                            <input
                            id="password"
                            name="password"
                            type="password"
                            value={form.password}
                            onChange={handleChange}
                            placeholder="Enter your password"
                            required
                            />

                            <button type="submit" className="login-submit-btn">
                                Log In
                            </button>
                        </form>

                        <p className="login-footer-text">
                            Need an account? <Link to="/register">Register</Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Login;